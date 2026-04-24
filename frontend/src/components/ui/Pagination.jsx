import Button from "./Button";

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) {
  if (totalItems === 0) {
    return null;
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{startItem}</span>
        {" "}to{" "}
        <span className="font-semibold text-slate-900">{endItem}</span> of{" "}
        <span className="font-semibold text-slate-900">{totalItems}</span>{" "}
        bookings
      </p>

      <div className="flex items-center gap-3 self-start md:self-auto">
        <Button
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-4 py-2 text-sm"
        >
          Previous
        </Button>

        <span className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
          Page {page} of {totalPages}
        </span>

        <Button
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-4 py-2 text-sm"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
