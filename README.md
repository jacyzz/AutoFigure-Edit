# AutoFigure-Edit

基于 [AutoFigure](https://github.com/ResearAI/AutoFigure)（[ICLR 2026](https://openreview.net/forum?id=5N3z9JQJKq)）二次开发。原项目将论文方法描述文本生成为可编辑的 SVG 矢量图，本仓库在此基础上新增了**图片上传转矢量图**功能，并对配置管理进行了完善。

---

## 新增功能

### 1. 图片上传转矢量图

原项目只支持从文本生成图片再转 SVG。现在新增 **Upload Figure** 模式：上传一张已有的图片，跳过 LLM 图片生成（Step 1），直接从 SAM3 分割开始，走完后续的图标提取、SVG 模板生成、图标替换流程，最终输出可编辑的 SVG。

适用场景：已有论文配图，想将其转为可编辑矢量图。

### 2. 配置管理完善

新增 `config.py` 模块，统一管理 Provider、API Key、SAM 后端等配置项。支持三级优先级：

```
请求参数（Web 表单 / CLI 参数） > .env 文件 > 内置默认值
```

服务端通过 `/api/config` 接口将默认值下发给前端，前端表单自动填充。

---

## 工作流程

```
文本模式:  方法文本 → [Step 1] LLM 生图 → [Step 2] SAM3 分割 → [Step 3] 图标提取+去背景 → [Step 4] SVG 模板 → [Step 5] 图标替换 → final.svg
上传模式:  上传图片 ──────────────────→ [Step 2] SAM3 分割 → [Step 3] 图标提取+去背景 → [Step 4] SVG 模板 → [Step 5] 图标替换 → final.svg
```

每步产出物都会通过 SSE 实时推送到前端 Canvas 页面，最终 SVG 加载到内嵌的 SVG-Edit 编辑器中。

---

## 快速开始

### 环境准备

```bash
# 使用 conda 环境
conda activate fig

# 安装依赖
pip install -r requirements.txt

# 安装 SAM3（如果使用本地 SAM 后端）
git clone https://github.com/facebookresearch/sam3.git
cd sam3 && pip install -e . && cd ..
```

### 配置 .env

```bash
cp .env.example .env
```

编辑 `.env`，至少配置一个 LLM Provider 的 API Key 和 HuggingFace Token：

```bash
# 必填：RMBG-2.0 去背景模型需要
# 先到 https://huggingface.co/briaai/RMBG-2.0 申请访问权限
HF_TOKEN=hf_xxx

# 选一个 Provider 配置 API Key
GEMINI_API_KEY=your_key        # Google Gemini
# OPENROUTER_API_KEY=your_key  # 或 OpenRouter
# BIANXIE_API_KEY=your_key     # 或 Bianxie
```

### 启动服务

```bash
python server.py
# 访问 http://localhost:8000
```

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env 填入 API Key
docker compose up -d --build
# 访问 http://localhost:8000
```

### CLI 模式

```bash
# 文本生成模式
python autofigure2.py \
  --method_file paper.txt \
  --output_dir outputs/demo \
  --provider gemini \
  --api_key YOUR_KEY

# 图片上传模式
python autofigure2.py \
  --input_mode upload_figure \
  --source_image_path path/to/image.png \
  --output_dir outputs/demo \
  --provider gemini \
  --api_key YOUR_KEY
```

---

## 配置说明

### LLM Provider

系统通过 LLM 完成两件事：**生成图片**（Step 1，image_model）和**生成 SVG**（Step 4，svg_model）。支持以下 Provider：

| Provider | 用途 | Base URL | 默认 Image Model | 默认 SVG Model |
|----------|------|----------|-------------------|-----------------|
| **gemini** | Google 官方 Gemini API | `generativelanguage.googleapis.com/v1beta` | `gemini-3-pro-image-preview` | `gemini-3.1-pro` |
| **openrouter** | 聚合 API，支持 Gemini/Claude 等多模型 | `openrouter.ai/api/v1` | `google/gemini-3-pro-image-preview` | `google/gemini-3.1-pro-preview` |
| **bianxie** | OpenAI 兼容 API | `api.bianxie.ai/v1` | `gemini-3-pro-image-preview` | `gemini-3.1-pro-preview` |
| **openai_compatible** | 自定义 OpenAI 兼容端点 | 自行设置 | `gpt-image-1` | `gpt-4.1` |

**API Key 环境变量对应关系：**

| Provider | 环境变量 |
|----------|----------|
| gemini | `GEMINI_API_KEY`（或 `GOOGLE_API_KEY`） |
| openrouter | `OPENROUTER_API_KEY` |
| bianxie | `BIANXIE_API_KEY` |
| openai_compatible | `ARK_API_KEY`（或 `AUTOFIGURE_API_KEY`） |

### SAM3 后端

SAM3 用于 Step 2 的图像分割，检测图中的图标、人物等元素。支持以下后端：

| 后端 | 说明 | 所需环境变量 |
|------|------|-------------|
| **roboflow** | Roboflow API（推荐，免费） | `ROBOFLOW_API_KEY` |
| **fal** | fal.ai API（免费注册） | `FAL_KEY` |
| **local** | 本地安装 SAM3 | 无（需 `pip install -e sam3`） |

### 全部环境变量一览

#### Provider 相关

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AUTOFIGURE_PROVIDER` | 默认 Provider | `gemini` |
| `AUTOFIGURE_BASE_URL` | 自定义 Base URL（覆盖 Provider 默认值） | — |
| `AUTOFIGURE_IMAGE_MODEL` | 图片生成模型 ID | 按 Provider 不同 |
| `AUTOFIGURE_SVG_MODEL` | SVG 生成模型 ID | 按 Provider 不同 |
| `AUTOFIGURE_IMAGE_SIZE` | 生图尺寸（仅 Gemini） | `4K` |
| `AUTOFIGURE_API_KEY` | 通用 API Key（当 Provider 无专用 Key 时使用） | — |
| `GEMINI_API_KEY` | Gemini API Key | — |
| `OPENROUTER_API_KEY` | OpenRouter API Key | — |
| `BIANXIE_API_KEY` | Bianxie API Key | — |
| `ARK_API_KEY` | OpenAI Compatible API Key | — |

#### SAM3 相关

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AUTOFIGURE_SAM_BACKEND` | SAM 后端 | `roboflow` |
| `AUTOFIGURE_SAM_PROMPT` | SAM 检测提示词（逗号分隔） | `icon,person,robot,animal` |
| `AUTOFIGURE_MIN_SCORE` | 最低置信度过滤 | `0.0` |
| `AUTOFIGURE_SAM_MAX_MASKS` | 最大检测数量 | `32` |
| `ROBOFLOW_API_KEY` | Roboflow API Key | — |
| `ROBOFLOW_API_URL` | Roboflow API 地址（可覆盖默认值） | — |
| `ROBOFLOW_API_FALLBACK_URLS` | Roboflow 备用地址（逗号分隔） | — |
| `FAL_KEY` | fal.ai API Key | — |

#### Pipeline 相关

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AUTOFIGURE_PLACEHOLDER_MODE` | 占位符模式：`label`/`box`/`none` | `label` |
| `AUTOFIGURE_MERGE_THRESHOLD` | SAM 检测框合并阈值（0 禁用合并） | `0.9` |
| `AUTOFIGURE_OPTIMIZE_ITERATIONS` | SVG 优化迭代次数（0 跳过） | `0` |
| `HF_TOKEN` | HuggingFace Token（RMBG-2.0 去背景模型必填） | — |

#### Docker / 网络相关

| 变量 | 说明 |
|------|------|
| `BASE_IMAGE` | Docker 基础镜像（受限网络可设镜像源） |
| `PIP_INDEX_URL` | pip 镜像源 |
| `PIP_EXTRA_INDEX_URL` | pip 额外镜像源 |
| `DOCKER_DNS_1` / `DOCKER_DNS_2` | 容器 DNS（解决 Roboflow 域名解析问题） |

#### 重试相关

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENROUTER_MULTIMODAL_RETRIES` | OpenRouter 多模态请求重试次数 | `3` |
| `OPENROUTER_MULTIMODAL_RETRY_DELAY` | 重试间隔（秒） | `1.5` |
| `SAM3_API_RETRIES` | SAM API 重试次数 | `3` |
| `SAM3_API_RETRY_DELAY` | SAM API 重试间隔（秒） | `1.5` |

---

## 项目结构

```
AutoFigure-Edit/
├── autofigure2.py         # 核心 pipeline（5 步流程）
├── server.py              # FastAPI 后端服务
├── config.py              # 配置解析模块
├── requirements.txt       # Python 依赖
├── .env.example           # 环境变量模板
├── Dockerfile             # Docker 构建
├── docker-compose.yml     # Docker 编排
├── web/                   # 前端
│   ├── index.html         # 输入配置页
│   ├── canvas.html        # SVG 编辑画布页
│   ├── app.js             # 前端逻辑
│   ├── styles.css         # 样式
│   └── vendor/svg-edit/   # 内嵌 SVG-Edit 编辑器
├── outputs/               # 生成产物（按任务 ID 分目录）
└── uploads/               # 用户上传文件
```

---

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--method_text` / `--method_file` | 方法文本（直接传入或指定文件） |
| `--input_mode` | `generate_from_text`（默认） 或 `upload_figure` |
| `--source_image_path` | 上传模式下的源图片路径 |
| `--output_dir` | 输出目录 |
| `--provider` | LLM Provider |
| `--api_key` | API Key |
| `--base_url` | 自定义 Base URL |
| `--image_model` / `--svg_model` | 模型 ID |
| `--image_size` | 生图尺寸（`1K`/`2K`/`4K`，仅 Gemini） |
| `--sam_backend` | SAM 后端（`roboflow`/`fal`/`local`） |
| `--sam_prompt` | SAM 检测提示词 |
| `--sam_api_key` | SAM API Key |
| `--sam_max_masks` | 最大检测数 |
| `--placeholder_mode` | 占位符模式 |
| `--merge_threshold` | 合并阈值 |
| `--optimize_iterations` | 优化迭代次数 |
| `--reference_image_path` | 风格参考图（文本模式） |

---

## 致谢

本项目基于 [AutoFigure / AutoFigure-Edit](https://github.com/ResearAI/AutoFigure)（ICLR 2026）二次开发，感谢原作者的工作。

原始论文：
- [AutoFigure: Generating and Refining Publication-Ready Scientific Illustrations](https://openreview.net/forum?id=5N3z9JQJKq)
- [AutoFigure-Edit: Generating Editable Scientific Illustration](https://arxiv.org/abs/2603.06674)
