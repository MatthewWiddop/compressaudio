module.exports = (total, emit, stage) => {
  let completed = -1;

  const increment = () => {
    completed++;
    emit({
      type: 'progress',
      stage,
      completed,
      total,
      percent: Math.round(completed / total * 100)
    });
  };
  increment()
  return increment;
}
