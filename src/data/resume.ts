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
    {
      label: 'GitHub',
      href: 'https://github.com/The-Magicians-Code/',
      printLabel: 'github.com/The-Magicians-Code',
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/taneltreuberg/',
      printLabel: 'linkedin.com/in/taneltreuberg',
    },
  ],
  summary:
    'Software Engineer with 6 years of experience across backend development, infrastructure automation, applied machine learning, and data analytics. Track record of measurable performance gains in energy-sector web apps and production computer vision for autonomous marine vessels, plus game-telemetry dashboards and self-hosted LLM analytics that drive product decisions — fluent in Python, Docker, and CI/CD.',
  experience: [
    {
      company: 'Lionbridge Games',
      role: 'Principal Data Analyst',
      location: { city: 'Remote', country: 'Poland' },
      dates: { start: '2024-07', end: null, display: 'Jul 2024 – Present' },
      tagline: 'Data pipelines, dashboards, and self-hosted LLM analytics for game studios.',
      bullets: [
        'Migrated the sentiment-analysis pipeline from a third-party external service to a self-hosted, internal, locally-run LLM, eliminating per-call vendor cost and keeping review data in-house.',
        'Partner with game-studio clients to refine data-extraction pipelines and build dashboards that surface immediately actionable insights, improving game balance and performance.',
        'Refactored the codebase of a player-review sentiment-analysis application and optimised its ingestion engine, increasing the speed at which game reviews are pulled and processed.',
      ],
    },
    {
      company: 'Organic Flow (Freelance)',
      role: 'Freelance Web Developer',
      location: { city: 'Remote', country: 'Poland' },
      dates: { start: '2026-02', end: null, display: 'Feb 2026 – Present' },
      tagline: 'Ground-up rebuild of a dance school’s WordPress/WooCommerce site as an edge-native commerce stack.',
      bullets: [
        'Rebuilt a Polish dance school’s WordPress + WooCommerce booking site as a custom edge-native stack (Astro SSR on Cloudflare Workers, Supabase, Przelewy24), cutting homepage HTML 5× with sub-500ms TTFB.',
        'Delivered a self-serve admin so the owner edits products, prices, and copy without a developer (changes live in ~60s), and layered abuse defense (Turnstile, rate limits, CSRF, signed webhooks) from Cloudflare primitives.',
      ],
    },
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
        'Optimised the inference pipeline (TensorRT FP16, ONNX, NVDEC decoding) for a 3.5× average speed-up with negligible accuracy loss (1.7 × 10⁻³ mAP), 26.8% lower energy use, and a 3.3°C temperature drop.',
        'Built a containerised inference system (YOLOv5 / Ultralytics, Docker on Nvidia NGC) deploying reproducibly to Jetson AGX Xavier (32 GB), with x86_64/aarch64 code paths and multi-camera support (3 inputs via GStreamer + OpenCV).',
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
      ],
    },
  ],
  // ATS-minimal, text-only skill curation for the resume PDF. This is
  // INTENTIONALLY a separate list from the website's visual stack in
  // src/data/techStack.ts (which carries logo slugs + `featured` rings and a
  // different, brand-mark-driven curation). The two overlap but are not the
  // same: items like TypeScript/NumPy/Pandas/GNU+Linux/macOS live only here;
  // ONNX/OpenCV/GStreamer/Kubernetes/Grafana/ELK/Postman/Scrapy live only there.
  // Shared items (Python, Docker, Jenkins, GitLab CI/CD, Flask, PostgreSQL, Git,
  // …) must be kept in sync by hand across both files.
  skills: [
    {
      label: 'Languages',
      items: ['Python', 'TypeScript', 'Swift', 'C++', 'JavaScript', 'SQL', 'Bash'],
    },
    {
      label: 'ML / AI',
      items: ['PyTorch', 'TensorFlow', 'TensorRT', 'NumPy', 'Pandas', 'Nvidia Jetson', 'LLMs (self-hosted)', 'LM Studio'],
    },
    {
      label: 'Infrastructure, Frameworks & Tools',
      items: [
        'Docker',
        'GitHub Actions',
        'Azure DevOps',
        'Power BI',
        'AWS S3',
        'Flask',
        'PostgreSQL',
        'Git',
        'Astro',
        'Supabase',
        'Cloudflare Workers',
        'GNU/Linux',
        'macOS',
      ],
    },
    {
      label: 'Interests',
      items: ['Social dancing (tango argentino, Brazilian zouk)', 'guitar and piano', 'physics'],
    },
  ],
  meta: {
    updatedAt: '2026-06',
  },
};
