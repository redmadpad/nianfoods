import moment from 'moment-jalaali';

// Configure moment-jalaali
moment.loadPersian({ dialect: 'persian-modern', usePersianDigits: false });

export const formatJalaliDate = (date: Date | string): string => {
  return moment(date).format('jYYYY/jMM/jDD');
};

export const formatJalaliDateTime = (date: Date | string): string => {
  return moment(date).format('jYYYY/jMM/jDD HH:mm');
};

export const getCurrentJalaliDate = (): string => {
  return moment().format('jYYYY/jMM/jDD');
};

export const parseJalaliDate = (jalaliDate: string): Date => {
  return moment(jalaliDate, 'jYYYY/jMM/jDD').toDate();
};

export const getJalaliMonthName = (month: number): string => {
  const months = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
    'مرداد', 'شهریور', 'مهر', 'آبان',
    'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  return months[month - 1] || '';
};

export const toGregorianDate = (jalaliDate: string): string => {
  return moment(jalaliDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
};

export const toJalaliDate = (gregorianDate: string): string => {
  return moment(gregorianDate, 'YYYY-MM-DD').format('jYYYY/jMM/jDD');
};
