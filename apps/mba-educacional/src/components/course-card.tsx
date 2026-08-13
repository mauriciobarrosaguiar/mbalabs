import Link from "next/link";
import type { Course } from "@/lib/mock-data";

export default function CourseCard({ course }: { course: Course }) {
  return (
    <article className="course-card">
      <Link className={`course-cover tone-${course.tone}`} href={`/curso/${course.slug}`}>
        <span className="course-kind">{course.kind}</span>
        <span className="cover-symbol">✦</span>
        <span className="cover-category">{course.category}</span>
      </Link>
      <div className="course-body">
        <div className="course-meta"><span>{course.category}</span><span>•</span><span>{course.hours}</span></div>
        <Link href={`/curso/${course.slug}`}><h3>{course.title}</h3></Link>
        {course.partner && <p className="partner-line">✓ {course.partner}</p>}
        <div className="course-bottom">
          <div><strong>{course.price}</strong>{course.oldPrice && <del>{course.oldPrice}</del>}</div>
          <span className="round-arrow">→</span>
        </div>
      </div>
      {course.badge && <span className="floating-badge">{course.badge}</span>}
    </article>
  );
}
