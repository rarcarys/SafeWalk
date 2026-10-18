function formatDuration(minutes, t = key => key) {
  const total = Math.max(0, Math.ceil(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return [hours ? `${hours} ${t('ч')}` : '', remainder || !hours ? `${remainder} ${t('мин')}` : ''].filter(Boolean).join(' ');
}
module.exports = { formatDuration };
