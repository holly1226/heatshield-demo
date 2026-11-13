# HeatShield

多城市高温风险与避暑资源 App 演示。

- 手机直接体验：https://holly1226.github.io/heatshield-demo/
- 电脑查看手机尺寸：https://holly1226.github.io/heatshield-demo/mobile-preview.html

## 本地运行

运行 `python3 -m http.server 8766`，打开 `http://127.0.0.1:8766/`。
无需安装依赖或运行后端。修改源码后提交并推送 `main`，GitHub Pages 自动发布。

`index.html` 为在线版本；`HeatShield.html` 为包含照片的单文件导出，供离线体验和手机尺寸预览使用。源文件修改后，需在原项目 `heatshield-app/` 运行 `python3 build.py`，再同步源码与导出文件到本仓库。

## 数据说明

包含项目本地的 5 座城市、81 个社区、46 处设施记录。风险为项目基线；天气、未来预测及提醒包含标明的示例数据。在线街道详情使用 OpenStreetMap；内置 Census TIGERweb 真实路网快照，网络连接失败时保留主干道、次干道和部分街道。快照范围有限，不是完整街道或导航数据；设施坐标待核验。3D 柱高代表风险评分，不代表真实建筑高度。账户、推送、实时余位和市政调度为界面演示。

14 张真实照片保留原作者及授权；8 处设施匹配本址历史照片，其余为明确标注的场景参考。详见 [照片授权](PHOTO_CREDITS.md) 及照片匹配清单。

## 第三方许可

Radix Colors、Lucide、Leaflet 的许可证保留在 `vendor/`。照片依各自许可使用。本仓库未授予项目原创代码及品牌额外的开源许可。


## 地图连接（2026-11-13）

首次连接和每次重试均设置 9 秒超时；失败保留随网页加载的真实路网，恢复后自动显示详细在线底图。路网数据和筛选说明见 [BASEMAP_CREDITS.md](BASEMAP_CREDITS.md)。已在浏览器验证请求失败、请求超时、重复重试、网络恢复及五城双主题页面。
