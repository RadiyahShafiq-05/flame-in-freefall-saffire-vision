"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
export default function AnalysisChart({ data }: { data: { name: string; value: number }[] }) {
  return (<div className="h-56"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="name" stroke="#888" /><YAxis stroke="#888" />
    <Tooltip contentStyle={{ background: "#12161c", border: "1px solid #1f2630" }} /><Bar dataKey="value" fill="#2ee59d" /></BarChart></ResponsiveContainer></div>);
}
