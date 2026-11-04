import { type Category, type Company } from "./contracts";

export const registry: Record<Category, { company: Company; url: string }[]> = {
  "Data Science & Analytics": [
    { company: "upGrad", url: "https://www.upgrad.com/data-science-pgc-iiitb/" },
    { company: "Great Learning", url: "https://utaustin.mygreatlearning.com/pg-program-data-science-and-business-analytics-course" },
    { company: "Simplilearn", url: "https://www.simplilearn.com/iitk-professional-certificate-course-data-analytics" },
    { company: "Emeritus", url: "https://programs.eictiitg.com/iitg-dsba-tech-certificate-programme" },
  ],
  "Executive / General Management": [
    { company: "upGrad", url: "https://www.upgrad.com/iim-bangalore-general-management-certificate-for-young-leaders/" },
    { company: "Great Learning", url: "https://www.mygreatlearning.com/pg-program-management-executive" },
    { company: "Simplilearn", url: "https://iimi.simplilearn.com/executive-general-management-program" },
    { company: "Emeritus", url: "https://iimk.emeritus.org/iimk-general-management-programme-for-business-excellence" },
  ],
};

// Identity expectations only. Reference fees/durations are never production inputs.
export const programExpectations: Record<Category, Record<string, { name: string; subject: RegExp; institution: RegExp }>> = {
  "Data Science & Analytics": {
    upGrad: { name: "IIIT Bangalore Data Science & AI certificate", subject: /data science/i, institution: /iiit\s*(?:b|bangalore)|international institute of information technology.?\s*bangalore/i },
    "Great Learning": { name: "UT Austin / Great Lakes Data Science PG program", subject: /data science/i, institution: /ut austin|university of texas|great lakes/i },
    Simplilearn: { name: "E&ICT Academy IIT Kanpur AI-Powered Data Analytics certificate", subject: /data analytics/i, institution: /iit\s*kanpur|indian institute of technology.?\s*kanpur/i },
    Emeritus: { name: "E&ICT Academy IIT Guwahati Data Science & Business Analytics certificate", subject: /data science/i, institution: /iit\s*guwahati|indian institute of technology.?\s*guwahati/i },
  },
  "Executive / General Management": {
    upGrad: { name: "IIM Bangalore General Management for Young Leaders", subject: /general management|young leaders/i, institution: /iim\s*(?:b\b|bx|bangalore)|indian institute of management.?\s*bangalore/i },
    "Great Learning": { name: "Great Lakes Executive PG Program in Management", subject: /management|executive mba/i, institution: /great lakes/i },
    Simplilearn: { name: "IIM Indore Executive General Management certificate", subject: /general management|epgm/i, institution: /iim\s*indore|indian institute of management.?\s*indore/i },
    Emeritus: { name: "IIM Kozhikode General Management programme", subject: /general management/i, institution: /iim\s*kozhikode|iimk|indian institute of management.?\s*kozhikode/i },
  },
};
