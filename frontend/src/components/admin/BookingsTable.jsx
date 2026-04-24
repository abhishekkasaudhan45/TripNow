import { formatDate, formatDateTime } from "../../utils/date";

const BookingRow = ({ booking }) => (
  <tr className="border-b border-slate-100 last:border-b-0">
    <td className="px-6 py-4 align-top">
      <div>
        <p className="font-medium text-slate-900">
          #{booking._id.slice(-6).toUpperCase()}
        </p>
        <p className="mt-1 text-xs text-slate-500">Booking reference</p>
      </div>
    </td>
    <td className="px-6 py-4 align-top">
      <div>
        <p className="font-medium text-slate-900">{booking.destination}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
          Travel destination
        </p>
      </div>
    </td>
    <td className="px-6 py-4 align-top">
      <span className="inline-flex min-w-12 justify-center rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
        {booking.guests}
      </span>
    </td>
    <td className="px-6 py-4 align-top text-sm text-slate-700">
      <p>{formatDate(booking.checkin)}</p>
      <p className="mt-1 text-xs text-slate-500">to {formatDate(booking.checkout)}</p>
    </td>
    <td className="px-6 py-4 align-top text-sm text-slate-700">
      {formatDateTime(booking.createdAt)}
    </td>
  </tr>
);

const MobileBookingCard = ({ booking }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Booking
        </p>
        <p className="mt-1 font-semibold text-slate-900">
          #{booking._id.slice(-6).toUpperCase()}
        </p>
      </div>
      <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
        {booking.guests} guests
      </span>
    </div>

    <div className="mt-4 space-y-3 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Destination
        </p>
        <p className="mt-1 font-medium text-slate-900">{booking.destination}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Travel dates
        </p>
        <p className="mt-1 text-slate-700">
          {formatDate(booking.checkin)} to {formatDate(booking.checkout)}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Created
        </p>
        <p className="mt-1 text-slate-700">{formatDateTime(booking.createdAt)}</p>
      </div>
    </div>
  </article>
);

function BookingsTable({ bookings }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-sm font-semibold text-slate-600">
              <th className="px-6 py-4">Reference</th>
              <th className="px-6 py-4">Destination</th>
              <th className="px-6 py-4">Guests</th>
              <th className="px-6 py-4">Travel Dates</th>
              <th className="px-6 py-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <BookingRow key={booking._id} booking={booking} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 md:hidden">
        {bookings.map((booking) => (
          <MobileBookingCard key={booking._id} booking={booking} />
        ))}
      </div>
    </>
  );
}

export default BookingsTable;
