# wasmos

在浏览器里跑真正的 Linux 发行版，没有后端。

## 快速开始

```bash
npm run dev   # → http://localhost:8080
```

必须通过这个服务器访问 —— 直接双击 html 文件会失败，见下面的 COOP/COEP 说明。

## 为什么不能"把发行版编译成 WASM"

这是最容易踩的认知陷阱。发行版不是一个可编译的东西，它是内核 + 几千个已编译的 ELF 二进制 + libc + 包管理生态。就算有全部源码，WASM 也接不住：

- 没有 `fork()` —— WASM 没有进程概念，无法复制线性内存的执行状态
- 没有 MMU、没有虚拟内存
- 没有信号、没有 ELF 动态链接器
- WASI 补的是文件/时钟/socket 这类"叶子"系统调用，补不了进程模型

所以真正跑通的路只有两条：**把 CPU 模拟器编译成 WASM**，让未修改的发行版镜像跑在里面（发行版根本不知道自己在浏览器里）；或者**改内核去迁就 WASM**，代价是砍掉 `fork` 和 `longjmp`。

| 方案 | 原理 | 发行版覆盖 | 速度 | 许可 |
|---|---|---|---|---|
| [CheerpX](https://cheerpx.io/) | x86 → WASM **JIT** | 仅 i386 | 最快 | 闭源专有，个人/开源免费 |
| [container2wasm](https://github.com/container2wasm/container2wasm) | Bochs / TinyEMU **解释** | 任意 Docker 镜像 | 慢 | Apache-2.0 |
| [linux-wasm](https://joelseverin.github.io/linux-wasm/) | 内核编译到 `arch/wasm` | 仅 BusyBox | 无模拟开销 | GPL，概念验证 |

## 为什么发行版都这么老

**CheerpX 只能跑 32 位 x86（i386/i686）的根文件系统。** 这是硬限制，直接决定了展位清单：

| 发行版 | i386 状况 |
|---|---|
| Debian | ✅ 12 (bookworm) 的 i386 端口仍在维护 |
| Alpine | ✅ x86 版持续发布 |
| Ubuntu | ⚠️ 18.04 是最后一个，之后官方放弃 i386 |
| CentOS | ⚠️ 7 有 i386（在 `vault.centos.org/altarch`），2024-06 EOL |
| Arch | ❌ 2017 年停止 i686，只剩零星社区镜像 |
| Rocky / Alma | ❌ 从来没有 i386 版本 |

需要新版 Ubuntu / Arch / Rocky 的话只能走 container2wasm（支持 x86_64），代价是 Bochs 解释执行，慢一个数量级。

## 结构

```
public/
  index.html            首页，展位列表从配置生成
  booth.html            通用展位页，?id= 选展位
  coi-serviceworker.js  给 GitHub Pages 注入 COOP/COEP
  lib/
    booths.js           展位清单 —— 加发行版只改这里
    cheerpx-boot.js     引导逻辑，终端和图形共用
dockerfiles/            各发行版的 ext2 镜像构建定义
tools/serve.mjs         本地开发服务器（带 COOP/COEP）
.github/workflows/
  build-images.yml      手动触发，构建 ext2 并发到 Releases
  deploy-pages.yml      推送 main 自动部署 Pages
```

## 踩过的坑

### COOP/COEP 是硬性前提

CheerpX 用 SharedArrayBuffer 在 Worker 间共享 VM 内存，浏览器只对 cross-origin isolated 的页面开放 SAB（Spectre 之后的限制）。缺了这两个响应头，`Linux.create()` 直接抛错：

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

GitHub Pages 不允许自定义响应头，所以用 [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) 通过 Service Worker 注入。它必须**同源提供、不能走 CDN**，且首次加载会强制刷新一次页面。

### 伪文件系统一个都不能少

挂载表里少写 `proc` / `sys` / `devpts` 会导致 udev 反复失败、X 会话起不完整，启动时间从 18 秒劣化到 82 秒。Xorg 通过 `/sys` 枚举 DRM 设备、通过 `/dev/pts` 分配伪终端。

### 黑屏的真相：耐心 + 别只采样顶部像素

调试图形展位时绕了很大的弯，把三件事误判成根因，全都不是：

- ~~`startx` 的 `hostname` 返回 `?` 导致 xauth 拒建 `.Xauthority`~~ —— 报错真实存在，但不致命
- ~~`i3: Cannot open display` 是 CheerpX 的 AF_UNIX 缺口~~ —— 实际是 X 还没就绪就去连（X 要 45–75 秒初始化）
- ~~shell 后台作业在 CheerpX 里活不下来~~ —— 被上一轮残留的 `Xorg.0.log` 污染了检测

**真正的原因**：i3 是平铺式 WM，没开窗口时桌面本来就是纯黑，只有顶部约 30px 的 i3bar —— 黑屏是正常现象。而首帧探测只扫了顶部 80 行像素，随 i3bar 渲染时机时灵时不灵；加上每次只等 2–3 分钟就判失败，首帧实际要 3 分钟以上。

教训：判断"渲染成功"要扫全画布，判断"失败"前要给够时间。

### EOL 发行版的源已经下线

构建镜像时最容易失败的一步。Ubuntu 18.04 要换 `old-releases.ubuntu.com`，CentOS 7 要换 `vault.centos.org/altarch`（i386 属于替代架构，不在主 `centos` 路径下）。不换源直接 404。

### 无害的报错

`MESA-LOADER: failed to open swrast` 那一堆只是 GLX 硬件加速不可用，2D 的 X 完全能跑，i3 不需要 GL。同理 `couldn't get display device` 后面紧跟 `(II) modeset(0): glamor initialization failed` —— II 是信息级，X 会回退到软件渲染继续跑。

### 图形模式的本质

不是"用 JS 启动 Xorg"，而是启动发行版自己的 init 让它去拉 Xorg。`setKmsCanvas(canvas, w, h)` 里的 KMS = Kernel Mode Setting —— CheerpX 模拟了一块 DRM/KMS 显卡，Xorg 用标准 modesetting 驱动往上画，完全不知道自己在浏览器里。

分辨率有 1024×768 最小值兜底：屏幕更小时放大内部分辨率再缩回显示，因为很多 X11 程序在这之下布局会崩。

## 构建自己的镜像

```bash
# 在 GitHub Actions 里手动触发 build-images 工作流，
# 或本地用 buildah + podman（需要 Linux 或 Linux 容器）：
buildah build --arch 386 -f dockerfiles/debian-12 -t wasmos-debian .
podman unshare bash -c '
  CT=$(buildah from wasmos-debian)
  MNT=$(buildah mount "$CT")
  mkfs.ext2 -L wasmos -b 4096 -d "$MNT" debian-12.ext2 1500M
  buildah umount "$CT"; buildah rm "$CT"
'
```

产出的 ext2 放到 GitHub Releases —— 不占仓库体积，且支持 HTTP Range 请求（CheerpX 按需拉块的前提，实测 `content-range` 正常返回）。CheerpX 镜像上限 2GB。

## 许可

本仓库的代码为 MIT。构建出的 ext2 镜像包含各发行版自己的二进制，遵循其各自的许可证（Debian/Ubuntu/CentOS 主要为 GPL 及兼容许可），本仓库不分发这些镜像的二进制内容，只提供构建定义。
