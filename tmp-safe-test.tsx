const statusAtual = String(row.status ?? "");
const statusFim = String.fromCharCode(99, 97, 110, 99, 101, 108, 97, 100, 111);
const isFim = statusAtual === statusFim;
