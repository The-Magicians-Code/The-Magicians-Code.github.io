// Single source of truth for /resume. Edit values here; the page re-renders.
// Dates are stored as semantic parts + a `display` string so future diffing
// (e.g. "show only roles since 2023") doesn't have to parse free-form text.

export interface ContactLink {
  label: string;
  href: string;
  // Optional override for what prints (e.g. "github.com/foo" instead of just "GitHub")
  printLabel?: string;
}

export interface DateRange {
  start: string; // ISO-ish: "2022-07"
  end: string | null; // null = present
  display: string; // "Jul 2022 – Jun 2024"
}

export interface ExperienceEntry {
  company: string;
  role: string;
  location: { city: string; country: string };
  dates: DateRange;
  // Short tagline shown collapsed in Interactive mode (1 sentence max).
  tagline?: string;
  bullets: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  location: { city: string; country: string };
  dates: DateRange;
  notes?: string[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface ResumeData {
  name: string;
  title: string;
  baseLocation: { city: string; country: string };
  contact: ContactLink[];
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  interests?: string;
  meta: {
    updatedAt: string; // "2026-05" — month-level is enough for a CV
  };
}

export const resume: ResumeData = {
  name: 'Tanel Treuberg',
  title: 'Software Engineer',
  baseLocation: { city: 'Warsaw', country: 'Poland' },
  contact: [
    { label: 'tanel.treuberg@gmail.com', href: 'mailto:tanel.treuberg@gmail.com' },
    {
      label: 'Portfolio',
      href: 'https://themagicianscode.dev',
      printLabel: 'themagicianscode.dev',
    },
  ],
  summary:
    'Software Engineer with 3 years of experience in backend development, infrastructure automation, and applied machine learning. Proven track record of delivering measurable performance improvements in energy-sector web applications and building production computer vision pipelines for autonomous marine vessels. Proficient in Python, Docker, and CI/CD, with a strong foundation in embedded ML deployment.',
  experience: [
    {
      company: 'Elering',
      role: 'Software Engineer',
      location: { city: 'Tallinn', country: 'Estonia' },
      dates: { start: '2022-07', end: '2024-06', display: 'Jul 2022 – Jun 2024' },
      tagline: 'Backend + automation work on Estonia’s national grid systems.',
      bullets: [
        'Refactored an internal web application (backend and frontend) that pulls data from the SCADA ISR database, reducing data export time by 10× and cutting average UI load time from ~8s to under 2s.',
        'Built and maintained Python automation scripts executed via GitLab CI/CD, eliminating ~15 hours/month of manual data processing across operations teams.',
        'Developed and tested features for the internal Balancing Market System (BMS), reducing message delivery latency and processing time by 30% for Estonia’s national energy grid operations.',
      ],
    },
    {
      company: 'Baltic WorkBoats',
      role: 'Software Engineer — Computer Vision & Embedded ML',
      location: { city: 'Nasva', country: 'Estonia' },
      dates: { start: '2021-11', end: '2022-07', display: 'Nov 2021 – Jul 2022' },
      tagline: 'Real-time computer vision for an autonomous Navy patrol vessel.',
      bullets: [
        'Designed and deployed a real-time computer vision system for an autonomous Navy patrol vessel (Navy 18 WP), enabling automated maritime object detection for unmanned maneuvering trials.',
        'Developed a unified, containerised inference system (YOLOv5 / Ultralytics, Docker on Nvidia NGC) that deploys reproducibly and dynamically adapts to the target hardware for edge operation on Jetson AGX Xavier (32 GB).',
        'Optimised inference pipeline using TensorRT FP16 quantisation, ONNX conversion, and NVDEC hardware video decoding, achieving an average 3.5× speed increase (best case 4.3×).',
        'Negligible accuracy loss (1.7 × 10⁻³ mAP), 26.8% lower energy consumption, and 3.3°C temperature reduction, enabling sustained autonomous operation at sea.',
        'Built multi-camera support (3 simultaneous inputs via GStreamer + OpenCV), reaching 1.4× throughput over single-input at the same resolution, with architecture-aware code paths for x86_64 dev and aarch64 production.',
      ],
    },
    {
      company: 'SP Engineers OÜ',
      role: 'Electrical Engineering Intern',
      location: { city: 'Tallinn', country: 'Estonia' },
      dates: { start: '2021-07', end: '2021-10', display: 'Jul 2021 – Oct 2021' },
      tagline: 'Firmware for ESP32-based sensor-monitoring prototypes.',
      bullets: [
        'Developed firmware for ESP32 microcontrollers powering sensor-aided monitoring prototypes, gaining hands-on experience with embedded C++ and hardware-software integration.',
      ],
    },
  ],
  education: [
    {
      institution: 'Tallinn University of Technology',
      degree: 'BSc in Engineering — Mechatronics (Electroenergetics & Mechatronics)',
      location: { city: 'Tallinn', country: 'Estonia' },
      dates: { start: '2020-09', end: '2023-06', display: 'Graduated Jun 2023' },
      notes: [
        'Thesis: “Improving Situational Awareness of Autonomous Vessels Using Computer Vision” — developed and benchmarked 10 YOLOv5 model variants on Jetson AGX Xavier for real-time maritime object detection.',
        'Organised TalTech Energy Conference 2020; former member of Faculty of Engineering Student Council (INSÜK).',
      ],
    },
  ],
  skills: [
    {
      label: 'Languages',
      items: ['Python', 'C++', 'JavaScript', 'TypeScript', 'SQL', 'Bash', 'Swift'],
    },
    {
      label: 'ML / AI',
      items: ['PyTorch', 'TensorFlow', 'TensorRT', 'NumPy', 'Pandas', 'Nvidia Jetson'],
    },
    {
      label: 'Infrastructure & DevOps',
      items: ['Docker', 'Jenkins', 'GitLab CI/CD', 'AWS S3'],
    },
    {
      label: 'Frameworks & Tools',
      items: ['Flask', 'Selenium', 'PostgreSQL', 'Git'],
    },
    {
      label: 'Platforms',
      items: ['GNU/Linux', 'macOS'],
    },
  ],
  interests:
    'Social dancing (tango argentino, Brazilian zouk), guitar and piano, physics.',
  meta: {
    updatedAt: '2026-06',
  },
};
