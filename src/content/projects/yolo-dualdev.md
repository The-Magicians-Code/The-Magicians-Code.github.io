---
title: Vision pipeline for *edge inference*
description: Bachelor's thesis (TalTech, 2023) — a real-time computer-vision system that gives an autonomous Baltic Workboats Navy 18 WP patrol vessel the situational awareness it needs to run its own sea trials.
repoUrl: https://github.com/The-Magicians-Code/Yolo-dualdev/
deepwikiUrl: https://deepwiki.com/The-Magicians-Code/yolo-dualdev
order: 1
bentoSpan: hero
coverVariant: base
cover: /covers/yolo-dualdev.jpg
draft: false
---

## Context

> A 2023 bachelor's thesis at TalTech: a real-time computer-vision system that gives an autonomous Baltic Workboats Navy 18 WP patrol vessel the situational awareness it needs to run its own sea trials.

A joint project between TalTech's Department of Electrical Power Engineering and Mechatronics, the TalTech Small Boat Competence Center, and Baltic Workboats. The goal was to automate *käigukatsed* — vessel speed and maneuverability sea trials — that had traditionally required a human captain to run the boat manually while a second person logged readings on paper. Different captains meant inconsistent inputs; manual logging meant inconsistent data. Removing the captain from the loop needed a vessel that could see what was around it. The thesis built the perception layer: an embedded computer-vision system mounted in the boat's forward control mast, fused with the existing x-band radar, AIS, and wind sensor, feeding object detections to the autopilot. Solo implementation, mentored on hardware + hypothesis by Heigo Mõlder (PhD) and Karl Janson (PhD).

## The problem

> Three camera streams at 1080p+, real-time ship detection at ≥15 FPS and ≥75% accuracy, on a sealed embedded box mounted in a boat mast — without monopolising the same Jetson that ran the radar bridge and the autopilot's control loop.

The brief was concrete: simultaneous input from three cameras (≥1000×1000 px each), ship-detection accuracy ≥75%, throughput ≥15 FPS, all running in a sealed enclosure exposed to weather and a wide thermal envelope. Software-wise, the harder constraint was sharing the embedded computer — radar, AIS, and the autopilot's control loop all lived on the same Jetson, so leaving CPU and GPU headroom was non-negotiable. The early version of the pipeline failed both ways: pulling raw video off three camera streams saturated the CPU on its own (radar communication degraded, thermal headroom evaporated), and the unoptimised PyTorch models barely touched the GPU's actual capacity. The system needed re-architecting so each piece of silicon did the work it was best at.

## The approach

> Containerised PyTorch + YOLOv5 (Ultralytics) pipeline on a Jetson AGX Xavier 32GB, with NVDEC-accelerated camera decoding through GStreamer, and TensorRT FP16 conversion via ONNX — built mirrored across x86_64 dev and aarch64 production containers.

**Compute**: Jetson AGX Xavier 32GB, chosen against the smaller Jetsons specifically for its 512-core Volta GPU, 64 Tensor Cores, dual NVDLA deep-learning accelerators, and 256-bit LPDDR4x memory at 136.5 GB/s — enough headroom to run a larger model and still leave CPU cycles for the radar + AIS bridging code. **Cameras**: started with the SurveilsQUAD Sony IMX290 multi-camera system, hit a cable-length limitation in the mast enclosure, and switched to Arducam Fisheye 5MP modules — the layout flexibility was worth the slight resolution trade-off. **Model**: YOLOv5 (Ultralytics), chosen over FasterRCNN / MobileNet SSD V2 / EfficientDet because of its single-pass architecture (CSPNet backbone, PANet neck, YOLO head) and the cleanest path through TensorRT. **Pipeline**: Docker containers mirrored across x86_64 (dev, NGC PyTorch base) and aarch64 (production, L4T-ML base) so the same code ran on both — small architecture-detecting helpers swapped the GStreamer decoder element (`nvv4l2decoder` on Jetson, software path in dev). **Optimisation**: PyTorch → ONNX → TensorRT FP16 conversion to push the model onto the Tensor Cores; OpenCV reserved for what the GPU couldn't do.

## The results

> Average 3.5× inference speedup (best case 4.3×) from TensorRT FP16 optimisation, with a negligible 1.7×10⁻³ mAP loss, while energy use dropped 26.8% (20.1W → 14.7W) and GPU utilisation went from 43.1% to 99.8%.

Measured over 1000 inference iterations on a Jetson AGX Xavier 32GB, across YOLOv5n/n6/s/s6/m/m6/l/l6/x/x6 at 640×640 and 1280×1280 input resolutions, with one and three parallel camera inputs. The headline numbers: average **3.5× speedup** after TensorRT FP16 conversion, with the best model pair (YOLOv5l6) hitting **4.3× faster** than its unoptimised PyTorch counterpart. Accuracy was effectively preserved — average mAP loss across the model lineup was **1.7×10⁻³**, well within margin of error for the application. Power and thermal envelope improved in lockstep: **26.8% less energy** (20.1W → 14.7W average), **operating temperature down 3.3%** (46°C → 44.5°C), GPU utilisation **43.1% → 99.8%** — the GPU was finally doing the work the CPU had been doing badly. Accuracy plateaued at the YOLOv5m / YOLOv5l models; bigger architectures didn't earn their inference cost on this dataset, so the deployed model sat at the knee of the curve.
