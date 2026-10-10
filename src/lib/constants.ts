export const APP_NAME = "CampusConnect Amrita";
export const CAMPUS_NAME = "Amrita Vishwa Vidyapeetham, Coimbatore";

/** Approximate campus centre used for the map; locations below are indicative, not surveyed. */
export const CAMPUS_CENTER: [number, number] = [10.9027, 76.9006];
export const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [10.88, 76.88],
  [10.93, 76.93],
];

export const CAMPUS_LOCATIONS: { label: string; lat: number; lng: number }[] = [
  { label: "Academic Block I", lat: 10.9031, lng: 76.8998 },
  { label: "Academic Block II", lat: 10.9038, lng: 76.9012 },
  { label: "Academic Block III", lat: 10.9022, lng: 76.9019 },
  { label: "Central Library", lat: 10.9026, lng: 76.9004 },
  { label: "Main Canteen", lat: 10.9017, lng: 76.8995 },
  { label: "Auditorium", lat: 10.9044, lng: 76.9001 },
  { label: "Sports Complex", lat: 10.9008, lng: 76.9024 },
  { label: "Hostel Area (North)", lat: 10.9056, lng: 76.9015 },
  { label: "Hostel Area (South)", lat: 10.8999, lng: 76.9004 },
  { label: "Main Gate", lat: 10.9002, lng: 76.8981 },
  { label: "Parking Area", lat: 10.9011, lng: 76.8986 },
  { label: "Library Walkway", lat: 10.9029, lng: 76.901 },
];

export const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Artificial Intelligence & Data Science",
  "Electronics & Communication Engineering",
  "Electrical & Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Aerospace Engineering",
  "Biomedical Engineering",
  "Cyber Security",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Business (Amrita School of Business)",
  "Social Work",
  "English & Humanities",
  "Administration",
] as const;

export const AFFILIATION_LABELS = {
  ug_student: "Undergraduate",
  pg_student: "Postgraduate",
  phd_scholar: "Doctoral scholar",
  faculty: "Faculty",
  staff: "Staff",
} as const;

export const ROLE_LABELS = {
  platform_admin: "Platform admin",
  safety_responder: "Safety responder",
  moderator: "Safety moderator (CampusShield)",
  faculty: "Verified faculty",
} as const;

export const VISIBILITY_LABELS = {
  campus: "Everyone on campus",
  connections: "Only people I follow",
  hidden: "Hidden from discovery",
} as const;

export const INTEREST_SUGGESTIONS = [
  "Machine Learning", "Healthcare Innovation", "Cybersecurity", "Robotics", "Entrepreneurship",
  "Sustainability", "Design", "Web Development", "Embedded Systems", "Data Science", "IoT",
  "Renewable Energy", "Photography", "Music", "Dance", "Theatre", "Debate", "Quizzing",
  "Open Source", "Competitive Programming", "Biomedical Devices", "Space Tech", "Finance",
  "Social Impact", "Writing", "Film", "Chess", "Football", "Cricket", "Volunteering",
];

export const SERVER_CATEGORIES = [
  "Department", "Club", "Elective", "Technical", "Research", "Hobby", "Sports", "Cultural", "Study group", "General",
];

export const CLUB_CATEGORIES = ["Technical", "Cultural", "Sports", "Social service", "Entrepreneurship", "Literary", "Arts", "Academic"];
export const EVENT_CATEGORIES = ["Workshop", "Competition", "Talk", "Cultural", "Sports", "Hackathon", "Meetup", "General"];
export const RESEARCH_AREAS = [
  "Artificial Intelligence", "Healthcare & Biomedical", "Cybersecurity", "Robotics & Automation", "Energy & Sustainability",
  "Communication Systems", "Materials", "Social Sciences", "Management", "Mathematics", "Other",
];
