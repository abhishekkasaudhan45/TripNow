function SectionHeading({ eyebrow, title, description, align = "center" }) {
  const alignment = align === "left" ? "text-left" : "text-center";

  return (
    <div className={alignment}>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-slate-600">{description}</p>}
    </div>
  );
}

export default SectionHeading;
