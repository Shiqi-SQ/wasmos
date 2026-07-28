// 展位清单。加一个发行版 = 在这里加一条，不用碰任何 HTML。
//
// 重要约束：CheerpX 只能跑 32 位 x86（i386/i686）的根文件系统。
// 这是硬限制，不是配置问题 —— 所以清单里全是 i386 镜像，
// Ubuntu 停在 18.04（之后官方放弃了 i386），Arch 只有零星社区镜像故未收录。
//
// diskImage 为 null 表示镜像还没构建，展位在首页显示为待构建。

// 镜像分发地址。放 COS 而非 GitHub Releases —— 后者不发 CORS 头，
// 浏览器拿不到（curl 能拿到是因为不受同源策略约束，这个坑很隐蔽）。
const CDN = 'https://sh-p1.furryfans.cn/wasmos';

export const BOOTHS = [
  {
    id: 'alpine-desktop-own',
    name: 'Alpine 桌面',
    codename: '3.19 · JWM',
    note: '自建镜像 · 有壁纸、任务栏、开始菜单',
    diskImage: `${CDN}/alpine-desktop.ext2`,
    mode: 'graphical',
    // 直接 xinit 拉起 X + JWM。不走 lightdm（依赖未实现的 VT_ACTIVATE），
    // 也不走 startx（它调 hostname 拼 X cookie，而 hostname 在 CheerpX 里返回 "?"）。
    cmd: '/usr/bin/xinit',
    args: ['/root/.xinitrc', '--', '/usr/bin/X', ':0', 'vt7', '-ac', '-nolisten', 'tcp'],
    uid: 0,
    gid: 0,
  },
  {
    id: 'debian-12-own',
    name: 'Debian 12',
    codename: 'bookworm',
    note: '自建镜像 · gcc / python3 / vim',
    diskImage: `${CDN}/debian-12.ext2`,
    mode: 'terminal',
    cmd: '/bin/bash',
    args: ['--login'],
    uid: 1000,
    gid: 1000,
  },
  {
    id: 'debian-12',
    name: 'Debian 10',
    codename: 'buster',
    // 实测 /etc/debian_version 是 10.13、uname -m 是 i386。
    // WebVM 官方托管的镜像就是 buster；自建的 bookworm 镜像
    // （dockerfiles/debian-12）构建好后换成 Releases 地址，
    // 届时这里的 name/codename 一并改回 12/bookworm。
    note: 'WebVM 官方镜像，预装 gcc / python3 / vim',
    diskImage: 'wss://disks.webvm.io/debian_large_20230522_5044875331.ext2',
    mode: 'terminal',
    cmd: '/bin/bash',
    args: ['--login'],
    uid: 1000,
    gid: 1000,
  },
  {
    id: 'alpine-desktop',
    name: 'Alpine Linux',
    codename: '3.17',
    note: 'i3 平铺桌面 + Xorg，53 个应用',
    diskImage: 'wss://disks.webvm.io/alpine_20251007.ext2',
    mode: 'graphical',
    // 图形模式走发行版自己的 init，让 OpenRC → lightdm → X → i3 全流程跑完
    cmd: '/sbin/init',
    args: [],
    uid: 0,
    gid: 0,
  },
  {
    id: 'ubuntu-1804',
    name: 'Ubuntu 18.04',
    codename: 'bionic',
    note: 'Ubuntu 最后一个支持 i386 的版本，2018 年',
    diskImage: null,
    mode: 'terminal',
    cmd: '/bin/bash',
    args: ['--login'],
    uid: 1000,
    gid: 1000,
  },
  {
    id: 'ubuntu-1604',
    name: 'Ubuntu 16.04',
    codename: 'xenial',
    note: '',
    diskImage: null,
    mode: 'terminal',
    cmd: '/bin/bash',
    args: ['--login'],
    uid: 1000,
    gid: 1000,
  },
  {
    id: 'centos-7',
    name: 'CentOS 7',
    codename: '',
    note: '2024 年 6 月 EOL，i386 镜像仍在 Docker Hub 上',
    diskImage: null,
    mode: 'terminal',
    cmd: '/bin/bash',
    args: ['--login'],
    uid: 1000,
    gid: 1000,
  },
  {
    id: 'debian-11',
    name: 'Debian 11',
    codename: 'bullseye',
    note: '',
    diskImage: null,
    mode: 'terminal',
    cmd: '/bin/bash',
    args: ['--login'],
    uid: 1000,
    gid: 1000,
  },
  {
    id: 'alpine-minimal',
    name: 'Alpine 3.21',
    codename: '',
    note: '最小镜像，约 8MB',
    diskImage: null,
    mode: 'terminal',
    cmd: '/bin/sh',
    args: ['-l'],
    uid: 0,
    gid: 0,
  },
];

export const byId = (id) => BOOTHS.find((b) => b.id === id);
