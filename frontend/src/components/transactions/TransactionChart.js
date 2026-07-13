import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7'];

export default function TransactionChart({ byCategory }) {
  const data = {
    labels: byCategory.map((item) => item.category),
    datasets: [
      {
        data: byCategory.map((item) => item.total),
        backgroundColor: COLORS
      }
    ]
  };

  if (byCategory.length === 0) {
    return <p>Sem despesas registradas neste mês.</p>;
  }

  return <Pie data={data} />;
}
