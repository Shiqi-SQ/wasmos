# wasmos

在浏览器里跑真正的 Linux 发行版，没有后端。

## 快速开始

```bash
npm run dev   # → http://localhost:8080
```

必须通过这个服务器访问。直接双击打开 html 文件会失败——见下面的 COOP/COEP 说明。

## 为什么不能"把发行版编译成 WASM"

这是最容易踩的认知陷阱。发行版不是一个可编译的东西，它是内核 + 几千个已编译的 ELF 二进制 + libc + 包管理生态。就算有全部源码，WASM 也接不住：

- 没有 `fork()`——WASM 没有进程概念，无法复制线性内存的执行状态
- 没有 MMU、没有虚拟内存
- 没有信号、没有 ELF 动态链接器
- WASI 补的是文件/时钟/socket 这类"叶子"系统调用，补不了进程模型

所以真正跑通的路只有两条：**把 CPU 模拟器编译成 WASM**，让未修改的发行版镜像跑在里面（发行版根本不知道自己在浏览器里）；或者**改内核去迁就 WASM**，代价是砍掉 `fork` 和 `longjmp`。

| 方案 | 原理 | 发行版覆盖 | 速度 | 许可 |
|---|---|---|---|---|
| [CheerpX](https://cheerpx.io/) | x86 → WASM **JIT** | Debian、Alpine | 最快 | 闭源专有，仅个人/开源免费 |
| [container2wasm](https://github.com/container2wasm/container2wasm) | Bochs / TinyEMU **解释** | 任意 Docker 镜像 | 慢 | Apache-2.0 |
| [linux-wasm](https://joelseverin.github.io/linux-wasm/) | 内核原生编译到 `arch/wasm` | 仅 BusyBox | 无模拟开销 | GPL，概念验证 |

## 展位

### Alpine Linux 图形桌面（已跑通）

`public/booths/alpine-desktop.html` — 完整 i3 窗口管理器跑在 Xorg 上，帧缓冲刷进 canvas。

### 其他发行版（待构建）

Ubuntu / Arch / Rocky / Debian 走 container2wasm 终端模式。前置条件：清理磁盘 + 装 Docker。

## 踩过的坑

### COOP/COEP 是硬性前提

CheerpX 用 SharedArrayBuffer 在 Worker 间共享 VM 内存，而浏览器只对 cross-origin isolated 的页面开放 SAB（Spectre 之后的限制）。缺了这两个响应头，`Linux.create()` 直接抛错：

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

localhost 下可免 HTTPS，部署到真实域名必须上 HTTPS。`tools/serve.mjs` 存在的唯一理由就是注入这两个头。

### 伪文件系统一个都不能少

挂载表里少写 `proc` / `sys` / `devpts` 会导致 udev 反复失败、X 会话起不完整（表现为黑屏），启动时间从 18 秒劣化到 82 秒。Xorg 通过 `/sys` 枚举 DRM 设备、通过 `/dev/pts` 分配伪终端。

### lightdm 在 CheerpX 上起不来

Alpine 官方镜像的 lightdm 配置本身是对的（autologin 到 i3，无需 greeter），X 也能成功初始化 modesetting 驱动、识别虚拟键鼠。但它启动 X 时带 `-novtswitch`，然后自己调 `VT_ACTIVATE` 切换 VT——**这个 ioctl 在 CheerpX 里返回 `Invalid argument`**：

```
DEBUG: Activating VT 7
WARNING: Error using VT_ACTIVATE 7 on /dev/tty0: Invalid argument
```

结果是 X 和 i3 都在跑，但 VT 7 从未激活，帧缓冲一片黑。绕过办法是不走 lightdm，直接 `startx`——它自己管 VT，不依赖 `VT_ACTIVATE`。

### 无害的报错

`MESA-LOADER: failed to open swrast` 那一堆只是 GLX 硬件加速不可用，2D 的 X 完全能跑，i3 不需要 GL。

### 图形模式的本质

不是"用 JS 启动 Xorg"，而是启动发行版自己的会话流程让它去拉 Xorg。`setKmsCanvas(canvas, w, h)` 里的 KMS = Kernel Mode Setting——CheerpX 模拟了一个 DRM/KMS 显卡，Xorg 用标准 modesetting 驱动往上画，完全不知道自己在浏览器里。

分辨率有 1024×768 最小值兜底：屏幕更小时放大内部分辨率再缩回显示，因为很多 X11 程序在这之下布局会崩。

## 结构

```
public/
  index.html              首页
  booths/
    alpine-desktop.html   Alpine + i3 图形展位
tools/
  serve.mjs               带 COOP/COEP 的开发服务器
```
