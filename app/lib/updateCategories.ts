export type UpdateCategory = "bug-fix" | "update" | "development";
export type UpdateStatus = "current" | "past";

export type UpdateEntry = {
  id: string;
  date: string;
  category: UpdateCategory;
  status: UpdateStatus;
  title: string;
  description: string;
  link?: string;
};

export const CATEGORY_META: Record<UpdateCategory, { label: string; color: string }> = {
  "bug-fix": { label: "Bug fix", color: "#F69C9F" },
  update: { label: "Update", color: "#FBF5AF" },
  development: { label: "Development", color: "#A2DEF8" },
};
