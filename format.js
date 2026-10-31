// Compact count: 1200 -> "1k2", 15300 -> "15k", 1500000 -> "1M5".
const formatCompactNumber = (value) => {
  const number = Math.floor(Number(value) || 0);

  if (number < 1000) {
    return String(Math.max(number, 0));
  }

  const units = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];

  for (const [size, suffix] of units) {
    if (number >= size) {
      const scaled = number / size;
      const whole = Math.floor(scaled);

      if (whole >= 10) {
        return `${whole}${suffix}`;
      }

      const decimal = Math.floor((scaled - whole) * 10);
      return decimal ? `${whole}${suffix}${decimal}` : `${whole}${suffix}`;
    }
  }
};

const formatDateTime = (value, locale) =>
  new Date(value).toLocaleString(locale || navigator.languages, { dateStyle: "medium", timeStyle: "medium" });
