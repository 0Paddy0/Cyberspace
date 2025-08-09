export async function loadData(path) {
  const res = await fetch(path);
  return res.json();
}
