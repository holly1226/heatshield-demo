# 本地真实路网来源

来源：U.S. Census Bureau，TIGERweb Transportation。

- 官方服务：https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer
- 官方开发者说明：https://www.census.gov/data/developers/data-sets/TIGERweb-map-service.html
- 数据目录及 CC0 许可：https://catalog.data.gov/dataset/tigerweb
- 取得时间、查询 URL 和各城市选择规则：`assets/basemaps/sources.json`。

快照覆盖本项目五城社区、设施坐标的包围框及每侧 0.045° 缓冲。保留 Primary Roads（图层 2）、Secondary Roads（图层 6），并从 Local Roads（图层 7）中选取每城片段数最多的 48 个已命名街道。同名片段合并为 MultiLineString，坐标经过服务端简化并保留五位小数；不是完整街道或导航数据。离开快照区域、放大查看小街道细节仍需在线底图。

`assets/basemaps/*.geojson` 是可核对的快照，`basemaps.js` 由 `build.py` 生成。地图展示保留 Census Bureau 署名。

这部分是独立的公共路网数据，不是下载或缓存 OpenStreetMap 街道瓦片。在线 OSM 瓦片仍只按当前视口请求，并保留署名与浏览器正常缓存。
