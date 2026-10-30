# 有节动作节拍器 · Capacitor 安卓版

粉色界面、离线中文语音、动作倒数、次数设置、先上后下或先下后上，以及每 N 次动作后的可选换气时间。

## 安装使用

安装提供的 `有节动作节拍器-1.0.0.apk`，点击桌面图标打开。这个安装包是签名测试版，可直接安装使用。

“训练时保持亮屏”默认开启：开始训练和换气期间保持常亮；暂停、重置、完成或离开应用后解除。状态会显示在开关旁边。关掉开关后遵循手机原来的息屏设置。

切到后台或手动锁屏会暂停训练，回到应用后点“继续这一组”。不在后台持续播报。

中文“上、下、换气、完成”和数字语音都在应用内，不需要网络或另装中文语音。

## 修改和构建

依赖：Node.js 22 及以上、JDK 21、Android SDK 36，以及构建工具。可以通过 Android Studio 配置这些环境。

1. 执行 `npm ci` 安装锁定的依赖。
2. 将 `JAVA_HOME` 指向 JDK 21，将 `ANDROID_HOME` 指向 Android SDK。也可在 `android/local.properties` 中配置 `sdk.dir`。
3. 执行 `npm test` 验证节拍、换气、语音调度与亮屏控制。
4. 执行 `npm run build:android`。安装包输出到 `dist/有节动作节拍器-1.0.0.apk`。

网页源码在 `web/index.html`；安卓原生亮屏控制在 `android/app/src/main/java/com/youjie/metronome/TrainingScreenPlugin.java`。

`npm run sync` 会将离线网页和 Capacitor 运行库同步到安卓工程。更新页面后重新构建 APK 即可。

正式分发版应配置自己的发布签名，并保留签名密钥，以便后续升级。
