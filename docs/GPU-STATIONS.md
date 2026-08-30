# GPU 스테이션 실무 — RTX 3090 ×8 × 2대

| | Station A | Station B |
|---|---|---|
| 보드 | ASRock Rack ROMED8-2T | WRX80 (ASUS Pro WS 계열) |
| CPU | EPYC 7542 (32c/64t, Rome) | Threadripper Pro 3975WX (32c/64t) |
| PCIe 레인 | 128 (PCIe 4.0) | 128 (PCIe 4.0) |
| GPU | RTX 3090 ×8 = 192GB VRAM | RTX 3090 ×8 = 192GB VRAM |
| **역할** | **상시 추론 서빙** (안정성 우선) | **학습·실험·인덱싱** (자유 재부팅) |

**역할을 반드시 고정하세요.** 한 대를 서빙 전용으로 못 박아야 [마이]가 항상 살아 있고,
다른 한 대에서 마음껏 커널 바꾸고 재부팅할 수 있습니다. 둘 다 겸용으로 쓰면 둘 다 불안정해집니다.

---

## 1. 먼저 알아야 할 3090의 구조적 한계

이걸 모르고 설계하면 성능이 기대의 1/3에서 멈춥니다.

### 1-1. NVLink는 사실상 없는 것으로 치세요
- 3090은 **2-way 브리지만** 지원합니다. NVSwitch도, 8-way 연결도 없습니다.
- 즉 **GPU 간 P2P 통신이 PCIe를 거치고, GeForce 드라이버는 P2P를 대체로 막습니다.**
  → 텐서 병렬(TP) 시 all-reduce 트래픽이 **호스트 메모리를 경유**합니다. 이게 최대 병목.

**대응**: `TP=8` 을 무작정 쓰지 마세요. 실측 후 아래 중 유리한 쪽을 고릅니다.

| 구성 | 적합한 상황 |
|---|---|
| TP=8 | 단일 거대 모델(235B급)이 8장에 걸쳐야만 올라갈 때. 통신비용 감수 |
| TP=4 + PP=2 | 70B급. all-reduce 그룹이 절반이라 통신 부담 감소 |
| **TP=2 또는 4 × 복수 replica** | **32B급 다중 동시 요청. 처리량 최적** |

작은 모델을 여러 replica로 돌리는 쪽이 큰 모델 하나를 8장에 펴는 것보다
**총 처리량이 훨씬 높습니다.** 배치 작업이 주라면 이쪽이 정답입니다.

### 1-2. Ampere에는 FP8 텐서코어가 없습니다
FP8은 Ada(4090)/Hopper부터입니다. 3090에서 FP8 양자화는 이득이 없거나 에뮬레이션으로 느려집니다.

**3090에서 쓸 양자화**:
- ✅ **AWQ INT4** (vLLM의 Marlin 커널) — Ampere 최적화가 가장 잘 되어 있음. **1순위**
- ✅ GPTQ INT4 (Marlin)
- ✅ BF16/FP16 — VRAM이 남을 때
- ❌ FP8 / MXFP4 — 네이티브 미지원. MXFP4 모델은 BF16으로 업캐스트되어 VRAM이 4배로 뜁니다.
  (gpt-oss-120b 같은 모델을 계획했다면 이 점을 먼저 실측하세요)

### 1-3. 8장을 7슬롯 보드에 꽂는 문제
ROMED8-2T도 WRX80E-SAGE도 **x16 슬롯이 7개**입니다. 8번째 GPU는
**x8/x8 분기(bifurcation) 라이저**가 필요합니다.

- 추론은 x8 PCIe 4.0으로 충분합니다 (가중치 로딩만 느려질 뿐).
- 학습/FSDP는 대역폭 영향이 큽니다 → Station B는 슬롯 배분에 더 신경 쓰세요.
- 라이저는 **PCIe 4.0 리타이머(redriver) 탑재 제품**을 쓰세요. 저가 3.0 라이저는
  4.0에서 링크 에러가 나고 학습 중 GPU가 떨어져 나갑니다.

---

## 2. 전력 — 프로젝트 최대 실패 지점

**여기서 실패하는 사람이 가장 많습니다. 하드웨어보다 먼저 해결하세요.**

### 2-1. 소비전력 계산

| 항목 | 스테이션당 |
|---|---|
| RTX 3090 ×8 @ 350W (기본) | 2,800W |
| CPU (EPYC 7542 / 3975WX) | 225~280W |
| 보드·메모리·NVMe·팬 | ~150W |
| **피크 합계** | **약 3,200~3,400W** |
| PSU 효율(80+ Platinum, 92%) 반영 벽면 부하 | **약 3,500~3,700W** |

**2대 동시 풀가동 = 약 7kW.**

### 2-2. 국내 전기 기준
- 일반 콘센트: 220V / 16A = 3,520W(이론). **연속부하는 80% = 2,816W 까지**가 안전선.
- → **스테이션 1대가 콘센트 1구를 초과합니다.**

**필수 조치**:
1. 스테이션당 **전용 회로 2개** (또는 30A 전용회로 1개). 분전반 작업이 필요하면 전기공사 업체를 부르세요.
2. 두 스테이션은 **반드시 서로 다른 회로**에.
3. PSU는 **1600W ×2** 또는 **1200W ×3** 구성 + `ADD2PSU` 동기화 어댑터.
4. 콘센트·멀티탭·연장선 재질 확인. 3kW를 일반 멀티탭에 물리면 화재 위험이 실재합니다.

### 2-3. 전력 제한이 최고의 투자

**3090은 전력 제한 시 성능 손실 대비 절감 효과가 매우 큽니다.**

```bash
# 부팅 시 자동 적용 — 8장 전체를 280W로 제한
sudo nvidia-smi -pm 1              # persistence mode
sudo nvidia-smi -pl 280            # 전 GPU 전력 제한

# systemd 서비스로 고정
sudo tee /etc/systemd/system/nvidia-powerlimit.service >/dev/null <<'EOF'
[Unit]
Description=Set RTX 3090 power limit
After=nvidia-persistenced.service

[Service]
Type=oneshot
ExecStart=/usr/bin/nvidia-smi -pm 1
ExecStart=/usr/bin/nvidia-smi -pl 280
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now nvidia-powerlimit
```

| 전력제한 | 스테이션 GPU 소비 | 추론 성능 |
|---|---|---|
| 350W (기본) | 2,800W | 100% |
| **280W** | **2,240W (-20%)** | **약 95% (권장)** |
| 250W | 2,000W (-29%) | 약 90% |

추론은 메모리 대역폭 병목이라 클럭을 낮춰도 손실이 작습니다.
**280W 제한은 사실상 공짜로 560W와 그만큼의 발열을 줄여줍니다.** 반드시 적용하세요.

### 2-4. 발열
7kW 전력 = **7kW 열**입니다. 냉방 환산 약 2톤(24,000 BTU) 에어컨 **2~3대분**.

- 일반 사무실 공간에서는 불가능합니다. **별도 공간 + 배기** 또는 서버랙 + 덕트가 필요합니다.
- 겨울에도 실온이 40℃를 넘깁니다. 3090은 GDDR6X 메모리 정션 온도가 취약(110℃ 스로틀)하니
  `nvidia-smi -q -d TEMPERATURE` 로 메모리 온도를 반드시 모니터링하세요.
- 소음도 실사용 기준 60~70dB. 사람이 상주하는 공간과 분리하세요.

---

## 3. 소프트웨어 스택

### 3-1. OS와 드라이버
```
Ubuntu 22.04 / 24.04 LTS  +  NVIDIA 드라이버 550 이상  +  CUDA 12.4+
```
- 데스크톱 환경 설치하지 마세요(서버 설치 이미지). GPU 메모리를 X 서버가 잡아먹습니다.
- IOMMU 활성화, `pcie_aspm=off` 커널 파라미터가 8-GPU 안정성에 도움이 됩니다.

### 3-2. 추론 서버 (Station A)
**vLLM** 이 정답입니다. 3090 8장에서 연속 배칭·PagedAttention 이득이 가장 큽니다.

```bash
# 예: Qwen3 32B AWQ, TP=2 × 4 replica (처리량 우선)
vllm serve Qwen/Qwen3-32B-AWQ \
  --tensor-parallel-size 2 \
  --quantization awq_marlin \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.90 \
  --host 127.0.0.1 --port 8001
```

```bash
# 예: 235B급 MoE, TP=8 (단일 거대 모델)
CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7 \
vllm serve <235B-AWQ-repo> \
  --tensor-parallel-size 8 \
  --quantization awq_marlin \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.92 \
  --enforce-eager \
  --host 127.0.0.1 --port 8000
```

- `--enforce-eager` 는 CUDA 그래프 캡처 메모리를 아낍니다. VRAM이 빠듯할 때 켜세요.
- P2P가 막힌 환경에서 TP 초기화가 멈추면 `NCCL_P2P_DISABLE=1 NCCL_IB_DISABLE=1` 을 붙입니다.
  (느려지지만 확실히 동작합니다. 3090 다중 GPU에서 흔한 처방입니다.)

### 3-3. 학습 (Station B)
- **QLoRA 70B**: 8×3090으로 충분히 가능. `axolotl` 또는 `unsloth` + DeepSpeed ZeRO-3 / FSDP.
- 풀 파인튜닝은 70B급에서는 비현실적입니다. LoRA/QLoRA로 한정하세요.
- 학습 중에는 P2P 병목이 더 크게 작용합니다. gradient accumulation을 키워 통신 횟수를 줄이세요.

### 3-4. 두 스테이션을 하나로 묶지 마세요
16장 = 384GB VRAM이 탐나지만, **노드 간 텐서 병렬은 하지 마세요.**
이더넷(10GbE 기준 1.25GB/s)은 GPU 간 통신 대역폭에 비해 100배 이상 느립니다.
TP를 노드에 걸치면 GPU가 놀면서 네트워크만 기다립니다.

**대신 이렇게**:
- 두 스테이션을 **독립 replica**로 두고 LiteLLM이 라운드로빈 → 처리량 2배
- 또는 **역할 분리**(A=서빙, B=학습) — 권장안

노드 간 결합이 의미 있으려면 InfiniBand(100Gb+)가 필요하고, 그건 별개 프로젝트입니다.

---

## 4. 모니터링 (선택이 아닌 필수)

3kW 장비를 무인 운영하려면 관측이 없으면 안 됩니다.

```bash
# 최소 구성
sudo apt install nvtop
pip install nvitop

# 상시 구성: DCGM Exporter + Prometheus + Grafana
docker run -d --gpus all --rm -p 9400:9400 nvidia/dcgm-exporter
```

**반드시 알람을 거세요**:
- GPU 온도 > 83℃, **메모리 정션 온도 > 100℃**
- GPU 하나가 목록에서 사라짐 (라이저 불량의 전형적 증상)
- vLLM 헬스체크 실패 → 자동 재시작 (systemd `Restart=always`)

---

## 5. 구축 체크리스트

```
[ ] 전용 전기회로 확보 (스테이션당 2회로 또는 30A)     ← 가장 먼저
[ ] 냉방·배기 계획 (7kW 열 처리)
[ ] 소음 격리 공간
[ ] PSU 다중화 + ADD2PSU
[ ] PCIe 4.0 리타이머 라이저 (8번째 GPU 분기용)
[ ] Ubuntu Server + 드라이버 550+ / CUDA 12.4+
[ ] nvidia-smi -pl 280 systemd 서비스 등록
[ ] Tailscale + tailscale ssh
[ ] vLLM 상시화 (systemd Restart=always)
[ ] DCGM 모니터링 + 온도 알람
[ ] LiteLLM 라우터에 백엔드 등록
```
