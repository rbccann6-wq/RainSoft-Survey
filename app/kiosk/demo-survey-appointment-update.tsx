// This is a temporary file to show the updated appointment section for demo-survey.tsx
// The same week view changes need to be applied to the appointment section in demo-survey.tsx

// Update the appointment state section:
const [appointmentAddress, setAppointmentAddress] = useState('');
const [selectedDate, setSelectedDate] = useState<Date | null>(null);
const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
const [selectedTime, setSelectedTime] = useState('');
const [appointmentNotes, setAppointmentNotes] = useState('');
const addressInputRef = useRef<any>();

// Add these helper functions:
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push(date);
  }
  return days;
}

// Replace calendar helper functions with week navigation:
const handlePrevWeek = () => {
  const newStart = new Date(currentWeekStart);
  newStart.setDate(newStart.getDate() - 7);
  setCurrentWeekStart(newStart);
};

const handleNextWeek = () => {
  const newStart = new Date(currentWeekStart);
  newStart.setDate(newStart.getDate() + 7);
  setCurrentWeekStart(newStart);
};

const isDateSelected = (date: Date) => {
  if (!selectedDate) return false;
  return (
    selectedDate.getDate() === date.getDate() &&
    selectedDate.getMonth() === date.getMonth() &&
    selectedDate.getFullYear() === date.getFullYear()
  );
};

const handleDateSelect = (date: Date) => {
  setSelectedDate(date);
  setSelectedTime('');
};

const isToday = (date: Date) => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Update the weekDays and getWeekRangeText:
const weekDays = getWeekDays(currentWeekStart);

const getWeekRangeText = () => {
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];
  const firstMonth = monthNames[firstDay.getMonth()];
  const lastMonth = monthNames[lastDay.getMonth()];
  
  if (firstMonth === lastMonth) {
    return `${firstMonth} ${firstDay.getDate()} - ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
  }
  return `${firstMonth} ${firstDay.getDate()} - ${lastMonth} ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
};
