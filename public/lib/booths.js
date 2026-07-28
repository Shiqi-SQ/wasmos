// 展位清单。加一个发行版 = 在这里加一条，不用碰任何 HTML。
//
// 重要约束：CheerpX 只能跑 32 位 x86（i386/i686）的根文件系统。
// 这是硬限制，不是配置问题 —— 所以清单里全是 i386 镜像，
// Ubuntu 停在 18.04（之后官方放弃了 i386），Arch 只有零星社区镜像故未收录。
//
// diskImage 为 null 表示镜像还没构建，展位在首页显示为待构建。

export const BOOTHS = [
  {
    id: 'debian-12',
    name: 'Debian 12',
    codename: 'bookworm',
    note: 'i386 端口仍在维护，是这里最新的 Debian',
    // WebVM 官方托管的镜像，先用着；自建镜像上线后换成 Releases 地址
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
