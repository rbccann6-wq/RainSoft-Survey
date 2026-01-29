// Survey questions and flow logic
export type QuestionType = 
  | 'yesno' 
  | 'choice' 
  | 'text' 
  | 'phone' 
  | 'zip' 
  | 'signature'
  | 'datetime'
  | 'address'
  | 'contact'
  | 'number'
  | 'multiselect';

export interface SurveyQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  note?: string;
  allowNext?: boolean;
  placeholder?: string;
  multiSelect?: boolean;
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'buys_bottled_water',
    question: 'Do you buy bottled water?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'is_homeowner',
    question: 'Are you a homeowner or currently purchasing a home?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'water_quality',
    question: 'How would you rate your current water quality?',
    type: 'choice',
    options: ['Good', 'Fair', 'Poor'],
    required: true,
  },
  {
    id: 'water_source',
    question: 'What is your water source?',
    type: 'choice',
    options: ['City/County', 'Well'],
    required: true,
  },
  {
    id: 'uses_filters',
    question: 'Do you use any filters on your drinking water?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'tastes_odors',
    question: 'Do you experience any tastes or odors with your tap water?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'people_in_home',
    question: 'How many people in your home use the water on a daily basis?',
    type: 'number',
    required: true,
    placeholder: 'Enter number',
  },
  {
    id: 'property_type',
    question: 'What type of property do you live in?',
    type: 'choice',
    options: ['House', 'Mobile Home', 'Apartment', 'Condo'],
    required: true,
  },
  {
    id: 'contact_info',
    question: 'Please provide your contact information',
    type: 'contact',
    required: true,
    placeholder: '',
  },
  {
    id: 'signature',
    question: 'Please sign to confirm your participation',
    type: 'signature',
    required: true,
  },
];

export const APPOINTMENT_TIMES = {
  weekday: ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM'],
  saturday: ['10:00 AM', '1:00 PM'],
  sunday: [], // No Sunday appointments
};

export const isWeekday = (date: Date): boolean => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

export const isSaturday = (date: Date): boolean => {
  return date.getDay() === 6;
};

export const getAvailableTimes = (date: Date): string[] => {
  if (isWeekday(date)) return APPOINTMENT_TIMES.weekday;
  if (isSaturday(date)) return APPOINTMENT_TIMES.saturday;
  return [];
};
