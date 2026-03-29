export interface Lesson {
  title: string;
  order: number;
  transcript?: string;
}

export interface CourseData {
  title: string;
  lessons: Lesson[];
}
