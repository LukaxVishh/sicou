export type Post = {
  id: string;
  companyId?: string | null;
  companyName: string;
  isGlobal: boolean;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type PagedPosts = {
  items: Post[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
};

export type PostFormData = {
  title: string;
  content: string;
  companyId?: string;
  publishToAllCompanies?: boolean;
  image?: File | null;
  removeImage?: boolean;
};
