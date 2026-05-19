---
title: Strato_Pi
description: A COVID-era TalTech course project — five engineers retrofitting an electrical-motor test rig with full remote control so coursework didn't stall when the lab closed.
repoUrl: https://github.com/The-Magicians-Code/Strato_Pi/
deepwikiUrl: https://deepwiki.com/The-Magicians-Code/Strato-Pi
order: 2
bentoSpan: wide
coverVariant: alt
draft: false
---

## Context

> Strato_Pi was a five-person TalTech practical product engineering project: retrofit a benchtop electrical-motor test rig with remote control so coursework could continue during the COVID lockdown without anyone in the lab.

The course brief landed during the COVID period: a benchtop motor measurement rig at TalTech needed someone physically in the lab to operate it — adjust load, read torque / current / RPM off the panel, log values by hand. With campus access restricted, the rig had become a bottleneck for the courses that depended on it. Our team of five — two backend engineers, two frontend engineers, and me as full-stack integration lead — had one semester to make the same measurements happen from a browser, without sacrificing data trustworthiness.

## The problem

> The rig was built for in-person operation — local knobs, paper logs, eyeball-on-the-multimeter — and offered no API, no live telemetry, no way to drive it from outside the lab.

Pre-pandemic, a student walked into the lab, set the motor load with a dial, waited for readings to stabilise, wrote values into a notebook, repeated. There was no software-controllable load command, no streaming readings, no historical record beyond the notebook. To turn this into a remote rig, we had to build the entire interaction layer from scratch: a control surface the hardware would accept, a backend that exposed it safely, a frontend students could actually use, and a deployment story that would keep the rig accessible to the course every weekday for the rest of the semester — all on top of a Strato Pi (a Raspberry-Pi-based industrial controller from Sfera Labs).

## The approach

> Five-person team, two months end-to-end: two backend engineers built the control + telemetry layer on the Strato Pi, two frontend engineers built the student-facing dashboard, and I owned the integration — the front-to-back contract, deployment, and the public web surface.

The system landed in three layers. **Backend** (Python on the Strato Pi) drove the motor controller, sampled telemetry at the rate the course needed, and exposed it as an HTTP API plus a live telemetry stream. **Frontend** (vanilla HTML / CSS / JS) gave students a live dashboard with control inputs, the streaming readings, and an in-page documentation panel for the course material. **My slice** was the join: nailing the API contract so the two halves could work in parallel without thrashing each other, packaging the whole stack into a `reinit.sh` script that redeployed the system to the production server with a single command, and putting the rig behind a public web surface with the right access controls so students could reach it from home. The repo's deliberate split — `Frontend/` and `Backend/` folders for in-progress work, a separate `myproject/` folder for what actually deployed — fell out of that integration workflow.

## The results

> Shipped a working MVP in 2 months, graded 5/5 by the course, and the rig ran without interruption for 3 months of remote coursework.

Full MVP delivered and demoed end-to-end at the two-month mark, with a 5/5 course grade. After delivery, the rig stayed in service for three months without an interruption — students booked remote sessions, ran their measurement sequences, and pulled the recorded readings without needing campus access. The integration discipline held across the run: a clean API contract between the frontend and backend halves let both teams iterate independently, and the single-command redeploy meant operating the rig didn't depend on whichever team member had touched the code last.
