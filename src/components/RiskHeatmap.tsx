import React, { useEffect, useRef } from 'react';

const d3 = (window as any).d3;

interface RiskHeatmapProps {
  messages: any[];
}

const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ messages }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !messages || !d3) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 30, bottom: 40, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data: Hourly buckets for each day of the week
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const heatMapData: { day: string, hour: number, value: number }[] = [];
    days.forEach(day => {
      hours.forEach(hour => {
        heatMapData.push({ day, hour, value: 0 });
      });
    });

    messages.forEach(m => {
      if (m.requiresTeacherIntervention) {
        const date = new Date(m.timestamp);
        const day = days[date.getDay()];
        const hour = date.getHours();
        const bucket = heatMapData.find(d => d.day === day && d.hour === hour);
        if (bucket) bucket.value++;
      }
    });

    // Scales
    const xScale = d3.scaleBand()
      .domain(days)
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(hours)
      .range([0, height])
      .padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([0, Math.max(1, d3.max(heatMapData, (d: any) => d.value))]);

    // Draw Heatmap Cells
    g.selectAll("rect")
      .data(heatMapData)
      .join("rect")
      .attr("x", (d: any) => xScale(d.day))
      .attr("y", (d: any) => yScale(d.hour))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d: any) => d.value > 0 ? colorScale(d.value) : "#f9fafb")
      .attr("rx", 4)
      .attr("ry", 4)
      .append("title")
      .text((d: any) => `${d.day}, ${d.hour}h: ${d.value} cảnh báo`);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .select(".domain").remove();

    g.append("g")
      .call(d3.axisLeft(yScale).tickValues([0, 6, 12, 18, 23]).tickSize(0))
      .select(".domain").remove();

    // Labels
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 20)
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .text("Bản đồ nhiệt nguy cơ (Theo giờ/thứ)");

  }, [messages]);

  return (
    <div className="w-full bg-white rounded-[2rem] border-2 border-gray-100 p-6 shadow-sm overflow-hidden">
      <svg ref={svgRef} viewBox="0 0 600 400" className="w-full h-auto"></svg>
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 font-medium justify-center">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-50 border border-gray-100 rounded"></div> An toàn</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-200 rounded"></div> Thấp</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Cao</div>
      </div>
    </div>
  );
};

export default RiskHeatmap;
