export type StaticScienceProject = {
  id: string;
  title: string;
  description: string;
  leadName: string;
  leadEmail: string;
  recentUpdateLabel?: string;
  recentUpdateUrl?: string;
};

export const SCIENCE_PROJECTS_PAGE_CONTENT = {
  title: "Science Projects",
  intro:
    "Announced EMERALD+DIVER science projects. Please brainstorm your ideas. If you have a project to pursue, contact the PI and announce it in Slack or the group email."
};

export const ANNOUNCED_SCIENCE_PROJECTS: StaticScienceProject[] = [
  {
    id: "project-1",
    title: "Project Title TBD",
    description: "Project description placeholder.",
    leadName: "TBD",
    leadEmail: "tbd@example.com"
  },
  {
    id: "project-2",
    title: "Project Title TBD",
    description: "Project description placeholder.",
    leadName: "TBD",
    leadEmail: "tbd@example.com"
  },
  {
    id: "project-3",
    title: "Project Title TBD",
    description: "Project description placeholder.",
    leadName: "TBD",
    leadEmail: "tbd@example.com"
  },
  {
    id: "project-4",
    title: "Project Title TBD",
    description: "Project description placeholder.",
    leadName: "TBD",
    leadEmail: "tbd@example.com"
  },
  {
    id: "project-5",
    title: "Project Title TBD",
    description: "Project description placeholder.",
    leadName: "TBD",
    leadEmail: "tbd@example.com"
  }
];
