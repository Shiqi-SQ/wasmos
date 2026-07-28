// CheerpX 引导逻辑。终端和图形两种模式共用这一套。
//
// 踩过的坑都记在注释里，别删：
//  - 伪文件系统少挂一个，X 会话就起不完整（表现为黑屏）
//  - i3 是平铺 WM，没开窗口时桌面本来就是纯黑，探测首帧必须扫全画布
//  - guest 的 stdout 不引出来的话，页面上看起来就像卡死

import * as CheerpX from 'https://cxrtnc.leaningtech.com/1.2.8/cx.esm.js';

// X11 程序在低于这个尺寸时布局会崩，所以放大内部分辨率再缩回来显示
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 768;

/**
 * @param {object} booth  来自 booths.js 的展位配置
 * @param {object} ui     { log(msg, kind), setStatus(text, cls), onReady() }
 * @param {HTMLElement} target  终端模式传 <pre>，图形模式传 <canvas>
 */
export async function boot(booth, ui, target) {
  if (!crossOriginIsolated) {
    throw new Error('页面未 cross-origin isolated —— SharedArrayBuffer 不可用');
  }
  if (!booth.diskImage) {
    throw new Error(`${booth.name} 的磁盘镜像尚未构建`);
  }

  ui.setStatus('加载磁盘镜像…');
  ui.log(`连接 ${booth.diskImage.replace(/^wss:\/\//, '')}`);

  // 有些网络环境会掐 WebSocket，失败时降级到普通 HTTPS
  let blockDevice;
  try {
    blockDevice = await createDevice(booth.diskImage);
  } catch (e) {
    if (!booth.diskImage.startsWith('wss:')) throw e;
    ui.log('WebSocket 失败，改用 HTTPS 重试…', 'err');
    blockDevice = await createDevice('https:' + booth.diskImage.slice('wss:'.length));
  }

  // 本地写入叠加在只读镜像之上 —— 改动能存下来，且已读的块会被缓存
  const idb = await CheerpX.IDBDevice.create(`wasmos-${booth.id}`);
  const overlay = await CheerpX.OverlayDevice.create(blockDevice, idb);

  ui.setStatus('创建实例…');
  const cx = await CheerpX.Linux.create({
    // 这五个一个都不能少。Xorg 通过 /sys 枚举 DRM 设备、
    // 通过 /dev/pts 分配伪终端，udev 和 OpenRC 需要 /proc。
    mounts: [
      { type: 'ext2', path: '/', dev: overlay },
      { type: 'devs', path: '/dev' },
      { type: 'devpts', path: '/dev/pts' },
      { type: 'proc', path: '/proc' },
      { type: 'sys', path: '/sys' },
    ],
  });

  let booted = false;
  let blockReads = 0;
  cx.registerCallback('diskActivity', () => {
    blockReads++;
    // 首帧后不再覆盖状态栏，否则会盖掉"已就绪"
    if (!booted && blockReads % 25 === 0) {
      ui.setStatus(`引导中… 已读 ${blockReads} 块`);
    }
  });

  if (booth.mode === 'graphical') {
    setupGraphical(cx, target, ui, () => { booted = true; });
  } else {
    // setConsole 直接把 guest 的 tty 接到 DOM，键盘输入也由它接管
    cx.setConsole(target);
    booted = true;
    ui.setStatus('就绪', 'ready');
    ui.onReady?.();
  }

  ui.log(`启动 ${booth.cmd} ${booth.args.join(' ')}`);
  const opts = {
    env: [
      'HOME=/home/user', 'USER=user', 'SHELL=/bin/bash',
      'TERM=xterm', 'LANG=en_US.UTF-8', 'LC_ALL=C',
      'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    ],
    cwd: booth.uid === 0 ? '/root' : '/home/user',
    uid: booth.uid,
    gid: booth.gid,
  };

  // 退出后重启，避免误按 exit 就整个死掉
  for (;;) {
    await cx.run(booth.cmd, booth.args, opts);
    ui.log('进程退出，重新启动…');
  }
}

async function createDevice(url) {
  // WebVM 官方的 wss:// 端点走 CloudDevice；
  // 自建镜像放 GitHub Releases，是普通 HTTP 字节范围请求，走 HttpBytesDevice。
  if (url.startsWith('wss:') || url.startsWith('https://disks.webvm.io')) {
    return CheerpX.CloudDevice.create(url);
  }
  return CheerpX.HttpBytesDevice.create(url);
}

function setupGraphical(cx, canvas, ui, markBooted) {
  const sync = () => {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return;
    let mult = 1.0;
    if (w < MIN_WIDTH) mult = MIN_WIDTH / w;
    if (h < MIN_HEIGHT) mult = Math.max(mult, MIN_HEIGHT / h);
    // KMS = Kernel Mode Setting。CheerpX 模拟了一块 DRM/KMS 显卡，
    // Xorg 用标准 modesetting 驱动往上画，完全不知道自己在浏览器里。
    cx.setKmsCanvas(canvas, Math.floor(w * mult), Math.floor(h * mult));
  };
  sync();
  window.addEventListener('resize', sync);

  // 文本控制台和图形帧缓冲共存，靠 VT 号切换。VT 7 是 X11 的传统落脚点。
  cx.setActivateConsole((vt) => {
    ui.log(`切换到 VT ${vt}`);
    if (vt === 7) canvas.style.zIndex = '5';
  });

  // 探测首帧。必须扫全画布 —— i3 没开窗口时只有顶部约 30px 的 bar，
  // 早期只采样前 80 行，结果随 i3bar 渲染时机时灵时不灵，被误判成"i3 没起来"。
  const probe = setInterval(() => {
    if (!canvas.width || canvas.width <= 300) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let painted = false;
    try {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] || px[i + 1] || px[i + 2]) { painted = true; break; }
      }
    } catch { /* canvas 可能还没准备好 */ }
    if (painted) {
      clearInterval(probe);
      markBooted();
      ui.log(`首帧已渲染（${canvas.width}×${canvas.height}）`);
      ui.log('i3 快捷键：Super+D 应用启动器，Super+Enter 终端');
      ui.setStatus('图形会话已激活', 'ready');
      canvas.focus();
      ui.onReady?.();
    }
  }, 1000);
}
