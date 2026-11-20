# 前文明档案馆 · Precursor Archive

前文明科幻 TRPG 设定百科：银河系联邦三维疆域图、世界档案、设定文库、人物志，以及小说《千金绑架案》《窒息的水》《圣彼得之钥》。

纯静态网站：没有数据库，不需要 Node 或任何构建步骤即可运行。路由用 `#hash`，任何静态主机（Cloudflare Pages、GitHub Pages、Nginx…）把仓库根目录当站点根目录即可。

> 本仓库由 claude.ai 上的托管版（2026-11-19 版本）整理而来：托管版里叠加的各次更新已合并回源文件，`index.html` 恢复为干净的入口。

## 本地运行

```sh
python3 -m http.server 8000      # 打开 http://localhost:8000 ，改完 JSON / Markdown 刷新即生效
```

想双击 `index.html` 离线打开，先运行一次 `python3 tools/build.py` 生成离线包（`data/bundle.js`、`data/img-bundle.js`，已被 git 忽略）。

## 日常维护流程

**唯一正本是这个仓库。** 任何设备改完都提交、推送；另一台设备开工前先拉取。

- **电脑**：`git pull` → 编辑（或让 Claude Code 编辑）→ `python3 tools/build.py --check` → `git commit` → `git push`
- **手机 / 路上**：在 Claude App 里开一个连着本仓库的会话，讨论后让 Claude 直接改文件、提交、推送。
- 部署（Cloudflare Pages 等）连上仓库后，每次推送自动更新网站。

## 目录

```
index.html                 入口
robots.txt                 禁止搜索引擎收录（页面里也有 noindex）
assets/css/app.css         样式（:root 中是全部主题色与字体）
assets/js/core.js          数据加载、编辑覆盖层、Markdown、交叉链接、搜索、坐标换算
assets/js/app.js           路由与页面（首页、世界、文库、小说、人物、工具、维护）
assets/js/atlas.js         三维疆域图与可视化编辑器（Three.js r128）
assets/vendor/             three.min.js、OrbitControls.js（打了切换“北方”的小补丁）、KaTeX
assets/img/                行星贴图、插画（art/）、航弦物理图（hx/）、欧罗巴生物图（europa/）
data/worlds.json           唯一的世界数据源（含 solar 太阳系段落）
data/pages.json            文库目录
data/characters.json       人物志
data/novels.json           小说书架
content/lore/*.md          设定词条
content/appendix/*.md      附录（航弦物理、欧罗巴生物学概论、通谕）
content/archive/*.md       原始设定 + 早期整理稿存档
content/novel/<书>/*.md    小说正文（qianjin、last-squid、keys-of-peter）
vatican/                   梵蒂冈网站风格的通谕页面（设定内文献）
tools/build.py             校验 / 生成离线包
```

## 编辑星图

1. **网页里编辑**：打开“星图”，点右上角“编辑”，拖动或修改字段后“保存”（保存在浏览器本地）。改完点“导出 worlds.json”，替换 `data/worlds.json` 并提交，修改才成为正式数据。
2. **直接改 JSON**：编辑 `data/worlds.json`，运行 `python3 tools/build.py --check` 校验。

### worlds.json 的世界字段

| 字段 | 必填 | 说明 |
|---|---|---|
| id | 是 | 稳定编号（英文、数字、连字符），用于链接 `#world-<id>`，改名时不要改 |
| name / en | 是 | 中文名 / 英文名 |
| kind | 是 | 分类，必须是 `categories` 的键，决定颜色 |
| status | 是 | 稳定航路、周期可达、待复联、失联、待开发、科考站、灾毁、特殊航路 |
| x, y, z | 是 | 联邦坐标（光年）。z = 天蝎主干方向（银经 20°），x 在银盘内，y 指向银北 |
| size | 否 | 星图圆点大小倍数，默认 1 |
| sector / domain | 否 | 星区 / 星域 |
| host / planet | 否 | 宿主恒星 / 行星 |
| summary | 否 | 简介 |
| facts | 否 | 任意键值对，显示为“档案字段” |
| aliases / tags | 否 | 别名（参与搜索与自动链接）/ 标签 |
| novel | 否 | true：在“小说地名”模式中常显名称 |
| solar | 否 | 太阳系内的世界 |
| group | 否 | remote（域外）/ explore（科考站） |

分类颜色、航路状态、包络尺寸（`regions`）、特殊航线（`routes`）、银河背景（`galaxy`）、太阳系天体与地点（`solar.bodies` / `solar.sites`）也都在 worlds.json 里。

## 加小说

- 新章节：Markdown 放进 `content/novel/<书>/`，在 `data/novels.json` 对应书的 `chapters` 里登记 `{"id","title","file"}`。
- 新的一卷：在 `books` 数组追加一本书（id 用英文），章节放进 `content/novel/<id>/`。
- 排版约定：以 `………` 开头的段落是系统日志；以 `▍` 开头的是直播弹幕；单独加粗的段落排成信件；单独一行 `……` 是场景分隔。

## 交叉链接

Markdown 中写 `[[天鹅三号]]` 会链接到同名的世界、人物或词条；正文中第一次出现的已知名称也会自动加链接。

## 坐标换算

“工具”页提供赤经 / 赤纬 / 距离 → 联邦坐标的双向换算：ICRS 单位向量经 IAU 标准矩阵转为银道直角坐标 (U, V, W)，再绕银北轴旋转 20°：

```
z = U·cos20° + V·sin20°
x = V·cos20° − U·sin20°
y = W
```

## 尚未收录

托管版里只有生成好的贴图，没有原来的 `tools/gen_textures.py`（地球“海平面 +8 米”淹没区贴图生成脚本）。贴图本身都在 `assets/img/`，需要重新生成时再补回脚本。
