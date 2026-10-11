// Demo data for CampusConnect Amrita. EVERYTHING here is fictional and labelled as demo data.
// Usage: node --env-file=.env.local scripts/seed.ts   (or: npm run db:seed)
// Requires SUPABASE_SERVICE_ROLE_KEY (server-only secret; never expose it to the browser).
// Re-running removes previous demo accounts (and their content, via cascades) and recreates them.

import { createClient } from "@supabase/supabase-js";

// Generic stock photos under the Unsplash License (see src/lib/photos.ts) — not real clubs or people.
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=70`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !serviceKey || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD (see .env.example).");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = "demo.campusconnect.test";

type Person = {
  key: string;
  name: string;
  affiliation: "ug_student" | "pg_student" | "phd_scholar" | "faculty" | "staff";
  department: string;
  program?: string;
  year?: number;
  bio: string;
  skills: string[];
  interests: string[];
  goals?: string[];
  roles?: ("platform_admin" | "incident_reviewer" | "moderator" | "faculty")[];
  visibility?: "campus" | "connections" | "hidden";
};

const PEOPLE: Person[] = [
  { key: "admin", name: "Demo Platform Admin", affiliation: "staff", department: "Administration", bio: "Fictional administrator account for the CampusConnect demo.", skills: ["Operations"], interests: ["Campus life"], roles: ["platform_admin", "moderator"] },
  { key: "security", name: "Ravi Kumar (Demo Grievance Cell)", affiliation: "staff", department: "Administration", bio: "Fictional central grievance cell reviewer for the demo.", skills: ["Investigations"], interests: ["Student welfare"], roles: ["incident_reviewer"] },
  { key: "maintenance", name: "Dr. Lakshmi Iyer (Demo CSE Reviewer)", affiliation: "faculty", department: "Computer Science & Engineering", bio: "Fictional department incident reviewer for CSE.", skills: ["Mentoring"], interests: ["Student welfare"], roles: ["incident_reviewer", "faculty"] },
  { key: "moderator", name: "Meera Nair", affiliation: "staff", department: "Administration", bio: "Fictional community moderator.", skills: ["Community management"], interests: ["Writing"], roles: ["moderator"] },
  { key: "anand", name: "Dr. Anand Krishnan", affiliation: "faculty", department: "Computer Science & Engineering", bio: "Fictional faculty member working on medical imaging and trustworthy ML.", skills: ["Machine Learning", "Computer Vision", "Python"], interests: ["Healthcare Innovation", "Machine Learning"], roles: ["faculty"] },
  { key: "priya", name: "Dr. Priya Raghavan", affiliation: "faculty", department: "Biomedical Engineering", bio: "Fictional faculty member building low-cost diagnostic devices.", skills: ["Biomedical Devices", "Signal Processing", "Embedded Systems"], interests: ["Healthcare Innovation", "Social Impact"], roles: ["faculty"] },
  { key: "karthik", name: "Karthik Subramanian", affiliation: "phd_scholar", department: "Artificial Intelligence & Data Science", program: "PhD", year: 3, bio: "Doctoral scholar (fictional) on federated learning for hospitals.", skills: ["Machine Learning", "PyTorch", "Research Writing"], interests: ["Machine Learning", "Cybersecurity"], goals: ["UI design", "Hardware partner"] },
  { key: "aditi", name: "Aditi Sharma", affiliation: "ug_student", department: "Computer Science & Engineering", program: "B.Tech CSE", year: 3, bio: "Building ML tools for healthcare. Looking for biomedical collaborators!", skills: ["Python", "React", "Machine Learning"], interests: ["Healthcare Innovation", "Machine Learning", "Open Source"], goals: ["Biomedical Devices", "Embedded Systems"] },
  { key: "rahul", name: "Rahul Menon", affiliation: "ug_student", department: "Biomedical Engineering", program: "B.Tech BME", year: 2, bio: "Wearables, ECG and sensors.", skills: ["Biomedical Devices", "Embedded Systems", "Arduino"], interests: ["Healthcare Innovation", "IoT", "Football"], goals: ["Machine Learning"] },
  { key: "sneha", name: "Sneha Pillai", affiliation: "ug_student", department: "Electronics & Communication Engineering", program: "B.Tech ECE", year: 3, bio: "Robotics, ROS and drones.", skills: ["ROS", "Embedded Systems", "C++"], interests: ["Robotics", "Space Tech", "Photography"], goals: ["Mechanical design"] },
  { key: "arjun", name: "Arjun Reddy", affiliation: "ug_student", department: "Mechanical Engineering", program: "B.Tech Mech", year: 4, bio: "CAD, prototyping and motorsport.", skills: ["Mechanical design", "SolidWorks", "3D Printing"], interests: ["Robotics", "Entrepreneurship"], goals: ["Embedded Systems"] },
  { key: "fatima", name: "Fatima Zahra", affiliation: "pg_student", department: "Cyber Security", program: "M.Tech Cyber Security", year: 1, bio: "CTFs and privacy engineering.", skills: ["Cybersecurity", "Linux", "Go"], interests: ["Cybersecurity", "Open Source", "Debate"] },
  { key: "vikram", name: "Vikram Joshi", affiliation: "ug_student", department: "Civil Engineering", program: "B.Tech Civil", year: 2, bio: "Sustainable campuses and water systems.", skills: ["GIS", "AutoCAD"], interests: ["Sustainability", "Renewable Energy", "Cricket"] },
  { key: "divya", name: "Divya Krishnan", affiliation: "pg_student", department: "Business (Amrita School of Business)", program: "MBA", year: 1, bio: "Product, design and early-stage startups.", skills: ["Design", "Product Management", "Figma"], interests: ["Entrepreneurship", "Design", "Photography"], goals: ["Web Development"] },
  { key: "nikhil", name: "Nikhil Varma", affiliation: "ug_student", department: "Electrical & Electronics Engineering", program: "B.Tech EEE", year: 3, bio: "Solar microgrids and power electronics.", skills: ["Power Electronics", "MATLAB"], interests: ["Renewable Energy", "Sustainability", "Music"], visibility: "connections" },
];

const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const at = (d: Date, h: number, m = 0) => {
  // h:m in IST (UTC+5:30)
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 5, m - 30));
  return x.toISOString();
};
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as NonNullable<T>;
}

async function removeOldDemoUsers() {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const demo = data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
    for (const u of demo) {
      const { error: delErr } = await db.auth.admin.deleteUser(u.id);
      if (delErr) throw new Error(`deleteUser ${u.email}: ${delErr.message}`);
    }
    if (data.users.length < 200) break;
  }
}

async function main() {
  console.log("Removing previous demo accounts…");
  // Clubs outlive their creators (ON DELETE SET NULL), so remove them explicitly.
  await must(db.from("clubs").delete().in("slug", ["circuit-breakers", "byte-brigade", "natya-collective", "green-campus", "lens-and-light", "launchpad-circle"]), "cleanup clubs");
  await removeOldDemoUsers();

  console.log("Creating demo accounts…");
  const id: Record<string, string> = {};
  for (const p of PEOPLE) {
    const { data, error } = await db.auth.admin.createUser({
      email: `${p.key}@${DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { full_name: p.name, handle: p.key },
    });
    if (error) throw new Error(`createUser ${p.key}: ${error.message}`);
    id[p.key] = data.user.id;
    await must(
      db.from("profiles").update({
        handle: p.key,
        full_name: p.name,
        affiliation: p.affiliation,
        department: p.department,
        program: p.program ?? null,
        year_of_study: p.year ?? null,
        bio: p.bio,
        skills: p.skills,
        interests: p.interests,
        goals: p.goals ?? [],
        visibility: p.visibility ?? "campus",
        onboarded: true,
      }).eq("id", data.user.id),
      `profile ${p.key}`,
    );
    for (const role of p.roles ?? []) {
      await must(db.from("user_roles").insert({ user_id: data.user.id, role }), `role ${p.key}`);
    }
  }

  console.log("Social graph & posts…");
  const follows: [string, string][] = [
    ["aditi", "rahul"], ["aditi", "anand"], ["aditi", "priya"], ["rahul", "aditi"], ["rahul", "priya"], ["sneha", "arjun"],
    ["arjun", "sneha"], ["fatima", "karthik"], ["divya", "aditi"], ["vikram", "nikhil"], ["karthik", "anand"], ["nikhil", "vikram"],
  ];
  await must(db.from("follows").insert(follows.map(([a, b]) => ({ follower_id: id[a], followee_id: id[b] }))), "follows");

  const clubsSeed = [
    { slug: "circuit-breakers", name: "Circuit Breakers Robotics Society", tagline: "Build, break, iterate — robots for every year.", category: "Technical", logo: "🤖", is_official: true, membership_policy: "approval", cover: "1532186773960-85649e5cb70b", creator: "sneha" },
    { slug: "byte-brigade", name: "Byte Brigade Coding Club", tagline: "Competitive programming, open source and hack nights.", category: "Technical", logo: "💻", is_official: true, membership_policy: "open", cover: "1555066931-78c471f0d4ea", creator: "aditi" },
    { slug: "natya-collective", name: "Natya Kala Dance Collective", tagline: "Classical and contemporary dance on campus.", category: "Cultural", logo: "💃", is_official: true, membership_policy: "approval", cover: "1463592177119-bab2a00f3ccb", creator: "divya" },
    { slug: "green-campus", name: "Green Campus Initiative", tagline: "Student-led sustainability projects.", category: "Social service", logo: "🌱", is_official: false, membership_policy: "open", cover: "1551855350-c86caeaf8707", creator: "vikram" },
    { slug: "lens-and-light", name: "Lens & Light Photography", tagline: "Photo walks, editing workshops and exhibitions.", category: "Arts", logo: "📷", is_official: false, membership_policy: "open", cover: "1502920917128-1aa500764cbd", creator: "divya" },
    { slug: "launchpad-circle", name: "LaunchPad Entrepreneurship Circle", tagline: "From idea to pitch — weekly founder meetups.", category: "Entrepreneurship", logo: "🚀", is_official: false, membership_policy: "approval", cover: "1556761175-5973dc0f32e7", creator: "divya" },
  ] as const;
  const club: Record<string, string> = {};
  for (const c of clubsSeed) {
    const row = await must(
      db.from("clubs").insert({
        slug: c.slug, name: c.name, tagline: c.tagline, category: c.category, logo: c.logo, is_official: c.is_official,
        membership_policy: c.membership_policy, created_by: id[c.creator], cover_url: photo(c.cover),
        description: `${c.tagline}\n\nThis is a fictional demo club created for the CampusConnect prototype. It does not represent a real Amrita organisation.`,
        requirements: c.membership_policy === "approval" ? "Open to all years. Coordinators review requests weekly." : "Anyone can join.",
      }).select("id").single(),
      `club ${c.slug}`,
    );
    club[c.slug] = row.id;
  }
  const clubMembers: [string, string, "member" | "coordinator", "approved" | "pending"][] = [
    ["circuit-breakers", "arjun", "coordinator", "approved"], ["circuit-breakers", "rahul", "member", "approved"], ["circuit-breakers", "nikhil", "member", "pending"],
    ["byte-brigade", "fatima", "member", "approved"], ["byte-brigade", "karthik", "member", "approved"], ["byte-brigade", "rahul", "member", "approved"],
    ["natya-collective", "aditi", "member", "pending"], ["green-campus", "nikhil", "member", "approved"], ["green-campus", "aditi", "member", "approved"],
    ["lens-and-light", "sneha", "member", "approved"], ["launchpad-circle", "arjun", "member", "pending"],
  ];
  await must(db.from("club_members").insert(clubMembers.map(([c, u, role, status]) => ({ club_id: club[c], user_id: id[u], role, status }))), "club members");

  const posts = [
    { a: "aditi", body: "Our team just finished a prototype that flags low-quality chest X-ray scans before they reach a radiologist 🩻 Looking for someone from BME who knows imaging hardware — DM me!", h: -30 },
    { a: "rahul", body: "Soldered my first 3-lead ECG front-end today. Noise is still terrible but it's alive. Anyone have tips on driven-right-leg circuits?", h: -26 },
    { a: "sneha", body: "Line-follower bot v3 hit 1.2 m/s on the test track 🚀 Thanks to everyone who stayed late at the lab.", h: -20 },
    { a: "fatima", body: "Reminder: never reuse your campus Wi-Fi password anywhere else. Password managers are free and they work. 🔐", h: -14 },
    { a: "divya", body: "Photo walk this Saturday morning around the campus gardens — bring any camera, phones totally welcome 📷", h: -8 },
    { a: "vikram", body: "Mapped every water cooler on campus for a GIS assignment. Turns out the Sports Complex needs at least one more!", h: -3 },
  ];
  const postIds: string[] = [];
  for (const p of posts) {
    const ts = new Date(Date.now() + p.h * 3600_000).toISOString();
    const row = await must(db.from("posts").insert({ author_id: id[p.a], body: p.body, created_at: ts, updated_at: ts }).select("id").single(), "post");
    postIds.push(row.id);
  }
  await must(db.from("posts").insert([
    { author_id: id.arjun, club_id: club["circuit-breakers"], is_announcement: true, body: "Recruitment drive for first-years is open! Join our intro-to-robotics workshop (see Events). No prior experience needed. (Fictional demo announcement)", created_at: new Date(Date.now() - 5 * 3600_000).toISOString() },
    { author_id: id.aditi, club_id: club["byte-brigade"], is_announcement: true, body: "Hack Night #4 is on — 24 hours, teams of up to 4, mentors from CSE and AI&DS. Register via Events. (Fictional demo announcement)", created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
  ].map((p) => ({ ...p, updated_at: p.created_at }))), "announcements");
  await must(db.from("post_likes").insert([
    { post_id: postIds[0], user_id: id.rahul }, { post_id: postIds[0], user_id: id.anand }, { post_id: postIds[0], user_id: id.priya },
    { post_id: postIds[2], user_id: id.arjun }, { post_id: postIds[2], user_id: id.aditi }, { post_id: postIds[3], user_id: id.karthik },
  ]), "likes");
  await must(db.from("comments").insert([
    { post_id: postIds[0], author_id: id.rahul, body: "This is exactly what our lab works on — messaging you!" },
    { post_id: postIds[0], author_id: id.priya, body: "Happy to advise. Drop by the BME lab on Thursday." },
    { post_id: postIds[1], author_id: id.sneha, body: "Shield your leads and keep them short. Also check your ground loop." },
  ]), "comments");

  console.log("Communities & messages…");
  const servers = [
    { key: "ai", name: "AI & ML Collective", description: "Paper reading, Kaggle teams and project help across departments.", icon: "🧠", cover: "1677442135703-1787eea5ce01", category: "Technical", visibility: "public", owner: "aditi", channels: ["papers", "projects"], members: ["rahul", "karthik", "fatima", "anand", "divya"] },
    { key: "robo", name: "Robotics Builders", description: "Hardware, firmware and late-night lab sessions.", icon: "🤖", cover: "1562758778-e5638b5b6607", category: "Technical", visibility: "public", owner: "sneha", channels: ["hardware", "ros-help"], members: ["arjun", "rahul", "nikhil"] },
    { key: "health", name: "Healthcare Innovation Lab", description: "Private space for the cross-disciplinary health-tech project team.", icon: "🧬", cover: "1576670262660-05cf76d53da3", category: "Research", visibility: "private", owner: "priya", channels: ["datasets", "device-design"], members: ["aditi", "rahul", "anand"] },
    { key: "cv", name: "Elective: Computer Vision (sample)", description: "Study group for students taking a computer vision elective. Sample community for the demo.", icon: "👁️", cover: "1501621667575-af81f1f0bacc", category: "Elective", visibility: "public", owner: "anand", channels: ["assignments", "doubts"], members: ["aditi", "karthik"] },
    { key: "photo", name: "Campus Photography", description: "Share shots, plan photo walks, swap editing tips.", icon: "📷", cover: "1452587925148-ce544e77e70d", category: "Hobby", visibility: "public", owner: "divya", channels: ["showcase"], members: ["sneha", "vikram"] },
  ] as const;
  const server: Record<string, string> = {};
  const channel: Record<string, string> = {};
  for (const s of servers) {
    const row = await must(db.from("servers").insert({ name: s.name, description: s.description, icon: s.icon, category: s.category, visibility: s.visibility, owner_id: id[s.owner], cover_url: photo(s.cover) }).select("id").single(), `server ${s.key}`);
    server[s.key] = row.id;
    const general = await must(db.from("channels").select("id").eq("server_id", row.id).eq("name", "general").single(), "general");
    channel[`${s.key}:general`] = general.id;
    for (const [i, name] of s.channels.entries()) {
      const ch = await must(db.from("channels").insert({ server_id: row.id, name, position: i + 1 }).select("id").single(), `channel ${name}`);
      channel[`${s.key}:${name}`] = ch.id;
    }
    await must(db.from("server_members").insert(s.members.map((m, i) => ({ server_id: row.id, user_id: id[m], role: i === 0 ? ("moderator" as const) : ("member" as const) }))), "server members");
  }
  await db.from("clubs").update({ server_id: server.robo }).eq("id", club["circuit-breakers"]);

  const msgs: [string, string, string, number][] = [
    ["ai:general", "aditi", "Welcome everyone 👋 Post what you're working on this semester!", -50],
    ["ai:general", "karthik", "Federated learning for hospital data here. Happy to help anyone getting started with PyTorch.", -48],
    ["ai:general", "rahul", "BME student here — curious how ML could clean up noisy ECG signals.", -45],
    ["ai:papers", "anand", "This week: a short survey on dataset shift in medical imaging. Discussion Friday at 4.", -30],
    ["ai:projects", "fatima", "Anyone want to team up for an ML security challenge? Need 2 more people.", -10],
    ["robo:general", "sneha", "Lab is open till 9 tonight. Bring your own soldering tips 🔧", -20],
    ["robo:hardware", "arjun", "3D-printed the new chassis. It's 40 g lighter.", -6],
    ["health:datasets", "priya", "Reminder: only use the synthetic dataset in /datasets for now — no real patient data in this prototype.", -12],
    ["health:general", "aditi", "Rahul and I sketched the ECG + ML pipeline. Sharing notes tomorrow.", -4],
    ["cv:doubts", "karthik", "If your homography is unstable, normalise your points first.", -15],
    ["photo:showcase", "divya", "Golden hour near the main lawn yesterday was unreal 🌅", -9],
  ];
  for (const [ch, a, body, h] of msgs) {
    await must(db.from("messages").insert({ channel_id: channel[ch], server_id: server[ch.split(":")[0]!], author_id: id[a], body, created_at: new Date(Date.now() + h * 3600_000).toISOString() }), "message");
  }
  await must(db.from("server_join_requests").insert({ server_id: server.health, user_id: id.sneha, message: "I can help with the device enclosure and sensors!" }), "join request");

  const conv = await must(db.from("conversations").insert({}).select("id").single(), "conversation");
  await must(db.from("conversation_members").insert([{ conversation_id: conv.id, user_id: id.aditi }, { conversation_id: conv.id, user_id: id.rahul }]), "conv members");
  await must(db.from("direct_messages").insert([
    { conversation_id: conv.id, sender_id: id.rahul, body: "Hey! Saw your X-ray post — I'd love to collaborate.", created_at: new Date(Date.now() - 28 * 3600_000).toISOString() },
    { conversation_id: conv.id, sender_id: id.aditi, body: "Amazing! Let's meet at the library walkway after class?", created_at: new Date(Date.now() - 27 * 3600_000).toISOString() },
  ]), "dms");

  console.log("Events…");
  const events = [
    { club: "circuit-breakers", org: "arjun", title: "Intro to Robotics Workshop (demo)", cover: "1581092333322-31d2fd38a35e", category: "Workshop", venue: "Academic Block II", s: at(days(2), 14), e: at(days(2), 17), cap: 40, dl: at(days(2), 10), desc: "Hands-on session: motors, sensors and your first line follower. Fictional demo event." },
    { club: "byte-brigade", org: "aditi", title: "Hack Night #4 (demo)", cover: "1631350397792-8e0c2de5b637", category: "Hackathon", venue: "Central Library", s: at(days(9), 18), e: at(days(10), 18), cap: 100, dl: at(days(8), 23), desc: "24-hour build sprint with mentors. Fictional demo event." },
    { club: "natya-collective", org: "divya", title: "Evening Dance Showcase (demo)", cover: "1756370256926-e48ca54c5efe", category: "Cultural", venue: "Auditorium", s: at(days(5), 18), e: at(days(5), 20), cap: null, dl: null, desc: "Classical and contemporary performances. Fictional demo event." },
    { club: "green-campus", org: "vikram", title: "Campus Clean-up Drive (demo)", cover: "1758599668429-121d54188b9c", category: "General", venue: "Main Gate", s: at(days(1), 7), e: at(days(1), 9), cap: 3, dl: at(days(1), 6), desc: "Gloves and bags provided. Small group — limited places. Fictional demo event." },
    { club: "lens-and-light", org: "divya", title: "Photo Walk: Campus Gardens (demo)", cover: "1760817075083-a2b82e9d0676", category: "Meetup", venue: "Library Walkway", s: at(days(-3), 6), e: at(days(-3), 8), cap: 25, dl: null, desc: "Past demo event." },
  ];
  const eventIds: string[] = [];
  for (const e of events) {
    const row = await must(db.from("events").insert({ club_id: club[e.club], organizer_id: id[e.org], title: e.title, description: e.desc, category: e.category, venue: e.venue, starts_at: e.s, ends_at: e.e, capacity: e.cap, registration_deadline: e.dl, cover_url: photo(e.cover) }).select("id").single(), `event ${e.title}`);
    eventIds.push(row.id);
  }
  await must(db.from("event_registrations").insert([
    { event_id: eventIds[0], user_id: id.rahul }, { event_id: eventIds[0], user_id: id.nikhil }, { event_id: eventIds[1], user_id: id.fatima },
    { event_id: eventIds[1], user_id: id.karthik }, { event_id: eventIds[3], user_id: id.nikhil }, { event_id: eventIds[3], user_id: id.arjun },
  ]), "registrations");

  console.log("Research & consultancy…");
  const projects = [
    { lead: "anand", title: "Quality control for chest X-ray datasets", area: "Healthcare & Biomedical", abstract: "Build tooling that detects low-quality or mislabeled radiographs before model training, using synthetic and public datasets only.", skills: ["Python", "Machine Learning", "Computer Vision"], commitment: "8 hrs/week, one semester", positions: 2 },
    { lead: "priya", title: "Low-cost wearable ECG patch", area: "Healthcare & Biomedical", abstract: "Design and validate a low-power ECG front-end and enclosure suitable for rural health camps. Bench testing only with volunteers' consent protocols.", skills: ["Embedded Systems", "Biomedical Devices", "Signal Processing"], commitment: "6 hrs/week, two semesters", positions: 3 },
    { lead: "karthik", title: "Privacy attacks on federated learning (student track)", area: "Cybersecurity", abstract: "Reproduce and evaluate membership-inference attacks on federated models in a simulated hospital network.", skills: ["PyTorch", "Cybersecurity"], commitment: "5 hrs/week", positions: 1 },
  ];
  const projectIds: string[] = [];
  for (const p of projects) {
    const row = await must(db.from("research_projects").insert({ kind: "research", lead_id: id[p.lead], title: p.title, area: p.area, abstract: p.abstract, description: `${p.abstract}\n\nThis is a fictional demo listing.`, required_skills: p.skills, commitment: p.commitment, positions: p.positions, department: PEOPLE.find((x) => x.key === p.lead)!.department }).select("id").single(), "project");
    projectIds.push(row.id);
  }
  const consult = await must(db.from("research_projects").insert({ kind: "consultancy", lead_id: id.priya, title: "Usability review for a clinic queue-management device", area: "Healthcare & Biomedical", abstract: "Seeking students with UX research and embedded UI skills to support a faculty-led consultancy engagement (subject to institutional approval).", required_skills: ["Design", "Embedded Systems"], commitment: "4 hrs/week, 6 weeks", positions: 2, department: "Biomedical Engineering" }).select("id").single(), "consultancy");
  await must(db.from("project_private_details").insert({ project_id: consult.id, budget_note: "Fictional: honorarium budget pending institutional approval.", agreement_note: "NDA required before client documents are shared." }), "private details");
  await must(db.from("research_applications").insert([
    { project_id: projectIds[0], applicant_id: id.aditi, statement: "I've built an image-quality classifier for a course project and would love to extend it to radiographs with proper validation.", relevant_skills: ["Python", "Machine Learning"], availability: "8 hrs/week" },
    { project_id: projectIds[1], applicant_id: id.rahul, statement: "I've built a basic ECG front-end on a breadboard and want to take it to a proper PCB with low-power design.", relevant_skills: ["Embedded Systems", "Arduino"], availability: "6 hrs/week", status: "shortlisted" },
  ], { defaultToNull: false }), "applications");

  console.log("Incident reports (fictional)…");
  const incidents = [
    { by: "aditi", direction: "about_staff", category: "unprofessional_conduct", subject: "Lab instructor (name withheld in demo)", dept: "Computer Science & Engineering", title: "Students repeatedly sent out of lab without explanation (demo)", desc: "FICTIONAL DEMO REPORT. During the last three lab sessions the instructor asked several students to leave without giving a reason, and we missed graded exercises as a result.", loc: "Academic Block II", ctx: "Data Structures lab", status: "under_review", d: -4 },
    { by: "rahul", direction: "about_staff", category: "verbal_abuse", subject: "Visiting lecturer (name withheld in demo)", dept: "Biomedical Engineering", title: "Insulting remarks during a project review (demo)", desc: "FICTIONAL DEMO REPORT. During the mid-semester project review, the lecturer made insulting remarks about a teammate's background in front of the class.", loc: "Academic Block I", ctx: "Project review", status: "submitted", d: -1 },
    { by: "anand", direction: "about_student", category: "academic_misconduct", subject: "Third-year student (name withheld in demo)", dept: "Computer Science & Engineering", title: "Identical submissions in a graded assignment (demo)", desc: "FICTIONAL DEMO REPORT. Two submissions for the machine learning assignment are identical, including comments and variable names, which suggests copying.", loc: null, ctx: "Machine Learning course", status: "action_taken", outcome: "Both students met the academic integrity committee; the assignment will be re-evaluated.", d: -12 },
  ] as const;
  const incidentIds: string[] = [];
  for (const r of incidents) {
    const created = new Date(Date.now() + r.d * 86_400_000);
    const row = await must(db.from("incidents").insert({
      reporter_id: id[r.by], direction: r.direction, category: r.category, subject_name: r.subject, department: r.dept, title: r.title,
      description: r.desc, occurred_on: dateOnly(new Date(created.getTime() - 86_400_000)), location: r.loc, context: r.ctx, status: r.status,
      outcome_note: "outcome" in r ? r.outcome : null, reviewed_by: r.status === "submitted" ? null : id.security, is_demo: true, created_at: created.toISOString(),
    }).select("id").single(), `incident ${r.title}`);
    incidentIds.push(row.id);
    const steps = r.status === "submitted" ? ["submitted"] : r.status === "under_review" ? ["submitted", "under_review"] : ["submitted", "under_review", r.status];
    for (const [i, st] of steps.entries()) {
      await must(db.from("incident_updates").insert({
        incident_id: row.id, actor_id: i === 0 ? id[r.by] : id.security, kind: "status", to_status: st,
        note: i === 0 ? "Report submitted with a truthfulness declaration" : "outcome" in r && st === r.status ? r.outcome : null,
        created_at: new Date(created.getTime() + i * 6 * 3600_000).toISOString(),
      }), "incident update");
    }
  }
  await must(db.from("incident_updates").insert({ incident_id: incidentIds[0], actor_id: id.maintenance, kind: "note", note: "Spoke to the lab coordinator; attendance records requested.", is_internal: true }), "internal note");

  console.log("Notifications…");
  await must(db.from("notifications").insert([
    { user_id: id.aditi, type: "research.application", title: "Your application to Quality control for chest X-ray datasets was received", link: `/research/${projectIds[0]}` },
    { user_id: id.priya, type: "server.request", title: "Sneha Pillai requested to join Healthcare Innovation Lab", link: `/communities/${server.health}/settings` },
    { user_id: id.maintenance, type: "incident.new", title: "New incident report for Computer Science & Engineering", link: `/incidents/${incidentIds[0]}` },
  ], { defaultToNull: false }), "notifications");

  console.log(`\nDone. ${PEOPLE.length} demo accounts created on @${DOMAIN} with the DEMO_PASSWORD from your env file.`);
  console.log("Try: aditi (student), rahul (student), priya (faculty), security (grievance cell reviewer), maintenance (CSE reviewer), moderator, admin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
