import React, { useEffect, useRef } from 'react';

const p5 = (window as any).p5;


interface MoodTreeProps {
  points: number;
  level: number;
  emotion?: string;
  isAnalyzing?: boolean;
}

const MoodTree: React.FC<MoodTreeProps> = ({ points, level, emotion, isAnalyzing }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<any>(null);


  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: any) => {
      let treePoints = points;
      let treeLevel = level;
      let currentEmotion = emotion || 'neutral';
      let angle = p.PI / 4;
      let sway = 0;

      p.setup = () => {
        const container = containerRef.current;
        if (container) {
          p.createCanvas(container.offsetWidth, 300).parent(container);
        }
        p.noLoop();
      };


      p.draw = () => {
        p.clear(0, 0, 0, 0);
        p.push();
        p.translate(p.width / 2, p.height);
        
        // Base growth based on level
        const baseLen = 60 + (treeLevel * 5);
        const depth = Math.min(treeLevel + 4, 10);
        
        // Sway effect
        sway += 0.02;
        const currentAngle = angle + p.sin(sway) * 0.05;

        drawBranch(baseLen, depth, currentAngle);
        p.pop();
      };

      const drawBranch = (len: number, d: number, a: number) => {
        // Line weight based on depth
        p.strokeWeight(p.map(d, 0, 10, 1, 8));
        
        // Color based on emotion
        let strokeCol;
        if (d < 3) {
          // Leaves
          if (currentEmotion.toLowerCase().includes('vui') || currentEmotion.toLowerCase().includes('tốt')) {
            strokeCol = p.color(52, 211, 153); // Emerald
          } else if (currentEmotion.toLowerCase().includes('buồn') || currentEmotion.toLowerCase().includes('lo')) {
            strokeCol = p.color(96, 165, 250); // Blue
          } else if (currentEmotion.toLowerCase().includes('cảnh báo') || currentEmotion.toLowerCase().includes('nguy cơ')) {
            strokeCol = p.color(248, 113, 113); // Red
          } else {
            strokeCol = p.color(167, 243, 208); // Light green
          }
        } else {
          // Trunk
          strokeCol = p.color(120, 113, 108); // Stone/Brown
        }
        
        p.stroke(strokeCol);
        p.line(0, 0, 0, -len);
        p.translate(0, -len);

        if (d > 0) {
          p.push();
          p.rotate(a);
          drawBranch(len * 0.7, d - 1, a);
          p.pop();
          
          p.push();
          p.rotate(-a);
          drawBranch(len * 0.7, d - 1, a);
          p.pop();
        }
      };

      p.windowResized = () => {
        const container = containerRef.current;
        if (container) {
          p.resizeCanvas(container.offsetWidth, 300);
        }
      };
    };

    sketchRef.current = new p5(sketch);

    return () => {
      sketchRef.current?.remove();
    };
  }, []);

  // Update sketch data when props change
  useEffect(() => {
    if (sketchRef.current) {
      // Force redrawing
      sketchRef.current.redraw();
    }
  }, [points, level, emotion]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-[300px] rounded-3xl bg-gradient-to-b from-white to-orange-50/30 border-2 border-orange-100/50 overflow-hidden relative ${isAnalyzing ? 'animate-pulse' : ''}`}
    >
      <div className="absolute top-4 left-4 z-10">
        <span className="text-xs font-bold text-orange-600 bg-white/80 px-2 py-1 rounded-full border border-orange-100 shadow-sm">
          Cây Tâm Hồn của em
        </span>
      </div>
    </div>
  );
};

export default MoodTree;
