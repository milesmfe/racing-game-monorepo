import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { useImmer } from "use-immer";

interface Point {
  x: number;
  y: number;
}
type SegmentType =
  | "normal"
  | "grid"
  | "pit"
  | "corner"
  | "finish"
  | "out-of-bounds";
type MergeType = "merge" | "split" | null;
interface Segment {
  id: string;
  points: { inner: Point[]; outer: Point[] };
  type: SegmentType;
  span: number;
  isCap: boolean;
  mergeType: MergeType;
  visible: boolean;
  isSquashed: boolean;
  data: number | null;
}
type Lane = Segment[];
type TrackLanes = Lane[];
interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface SegmentMetrics {
  centerX: number;
  centerY: number;
  angle: number;
  fontSize: number;
}
interface PathCacheEntry {
  point: Point;
  normalAngle: number;
}
const segmentLength = 40;
const laneWidth = 20;
const edgeResolution = 10;
const playerColors: { [key: number]: string } = {
  0: "#ffc107",
  1: "#dc3545",
  2: "#007bff",
  3: "#28a745",
  4: "#fd7e14",
  5: "#6c757d",
  6: "#17a2b8",
  7: "#6610f2",
};

interface TrackSegmentProps {
  segment: Segment;
  lane: Lane;
  segmentIndex: number;
  isSelected: boolean;
  onClick: () => void;
}
const TrackSegment: React.FC<TrackSegmentProps> = React.memo(
  ({ segment, lane, segmentIndex, isSelected, onClick }) => {
    const toPointsString = (points: Point[]): string =>
      points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const calculateMergedPoints = (lane: Lane, startIndex: number): string => {
      const startSegment = lane[startIndex];
      if (!startSegment || startSegment.isSquashed) return "";
      const fullInnerEdge: Point[] = [],
        fullOuterEdge: Point[] = [];
      for (let i = 0; i < startSegment.span; i++) {
        const s = lane[(startIndex + i) % lane.length];
        if (!s) continue;
        const isLastSegmentInSpan = i === startSegment.span - 1;
        fullInnerEdge.push(
          ...(isLastSegmentInSpan
            ? s.points.inner
            : s.points.inner.slice(0, -1))
        );
        fullOuterEdge.push(
          ...(isLastSegmentInSpan
            ? s.points.outer
            : s.points.outer.slice(0, -1))
        );
      }
      return toPointsString([...fullInnerEdge, ...fullOuterEdge.reverse()]);
    };
    const getSegmentMetrics = useCallback(
      (seg: Segment): SegmentMetrics | null => {
        if (!seg || !seg.points.inner.length || !seg.points.outer.length)
          return null;
        const allPoints = [...seg.points.inner, ...seg.points.outer];
        const sumX = allPoints.reduce((acc, p) => acc + p.x, 0);
        const sumY = allPoints.reduce((acc, p) => acc + p.y, 0);
        let centerX = sumX / allPoints.length;
        let centerY = sumY / allPoints.length;
        const p_start = seg.points.inner[0];
        const p_end = seg.points.inner[seg.points.inner.length - 1];
        const directionAngle =
          Math.atan2(p_end.y - p_start.y, p_end.x - p_start.x) *
          (180 / Math.PI);
        const angle = directionAngle + 90;
        const width = Math.hypot(
          seg.points.outer[0].x - seg.points.inner[0].x,
          seg.points.outer[0].y - seg.points.inner[0].y
        );
        let fontSize = width * 0.5;
        if (seg.type === "grid") {
          fontSize *= 0.5;
          const shiftAngleRad = (directionAngle + 180) * (Math.PI / 180);
          const segmentHeight = Math.hypot(
            p_end.x - p_start.x,
            p_end.y - p_start.y
          );
          const halfTextWidth = fontSize * 0.75;
          const padding = segmentHeight * 0.1;
          const shiftDistance = segmentHeight / 2 - halfTextWidth - padding;
          centerX += shiftDistance * Math.cos(shiftAngleRad);
          centerY += shiftDistance * Math.sin(shiftAngleRad);
        }
        return { centerX, centerY, angle, fontSize };
      },
      []
    );
    const getPolygonStyle = useCallback((seg: Segment): React.CSSProperties => {
      if ((seg.type === "grid" || seg.type === "pit") && seg.data !== null)
        return { fill: playerColors[seg.data] || "#cccccc" };
      return {};
    }, []);
    const shouldDisplayText = (seg: Segment) =>
      (seg.type === "corner" || seg.type === "grid" || seg.type === "pit") &&
      seg.data !== null;
    const getSegmentText = (seg: Segment) =>
      seg.type === "corner"
        ? seg.data
        : seg.type === "grid" || seg.type === "pit"
        ? Number(seg.data) + 1
        : "";
    const getSegmentClassNames = (seg: Segment) =>
      [
        "segment",
        seg.type,
        isSelected && "selected",
        seg.isCap && "cap",
        seg.mergeType === "merge" && "merge-marker",
        seg.mergeType === "split" && "split-marker",
      ]
        .filter(Boolean)
        .join(" ");
    if (segment.span <= 0 || !segment.visible || segment.isSquashed)
      return null;
    const metrics = getSegmentMetrics(segment);
    const pointsString = calculateMergedPoints(lane, segmentIndex);
    return (
      <g key={segment.id} className="segment-group">
        <polygon
          points={pointsString}
          className={getSegmentClassNames(segment)}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={getPolygonStyle(segment)}
        />
        {metrics && shouldDisplayText(segment) && (
          <text
            x={metrics.centerX}
            y={metrics.centerY}
            transform={`rotate(${metrics.angle}, ${metrics.centerX}, ${metrics.centerY})`}
            fontSize={metrics.fontSize}
            fontFamily="sans-serif"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            stroke="black"
            strokeWidth={metrics.fontSize * 0.05}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {getSegmentText(segment)}
          </text>
        )}
      </g>
    );
  }
);

// ==========================================================
// =============== MAIN TRACK DESIGNER COMPONENT =============
// ==========================================================
const TrackDesigner: React.FC = () => {
  const [mode, setMode] = useState<"drawing" | "editing">("drawing");
  const [points, setPoints] = useState<Point[]>([]);
  const [numberOfLanes, setNumberOfLanes] = useState(4);
  const [trackLanes, setTrackLanes] = useImmer<TrackLanes>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null
  );
  const [segmentDataInput, setSegmentDataInput] = useState<string>("");
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: 0,
    y: 0,
    width: 1000,
    height: 700,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pathData, setPathData] = useState("");
  const svgElement = useRef<SVGSVGElement | null>(null);
  const pathElement = useRef<SVGPathElement | null>(null);

  const trackLanesRef = useRef(trackLanes);
  useEffect(() => {
    trackLanesRef.current = trackLanes;
  }, [trackLanes]);

  const viewBoxString = useMemo(
    () => `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    [viewBox]
  );

  const selectedSegment = useMemo<Segment | null>(() => {
    if (!selectedSegmentId) return null;
    const [l, s] = selectedSegmentId
      .replace("l", "")
      .replace("s", "")
      .split("-")
      .map(Number);
    return trackLanes[l]?.[s] ?? null;
  }, [selectedSegmentId, trackLanes]);

  const trackGeometrySignature = useMemo(() => {
    if (trackLanes.length === 0) return "";
    return JSON.stringify(
      trackLanes.map((lane) =>
        lane.map((segment) => ({
          merge: segment.mergeType,
          span: segment.span,
        }))
      )
    );
  }, [trackLanes]);

  const isClockwise = useCallback((pts: Point[]): boolean => {
    if (!pts || pts.length < 3) {
      return false;
    }
    let sum = 0.0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return sum > 0;
  }, []);

  const generatePolyline = useCallback((points: Point[]): string => {
    if (points.length < 1) return "";
    return "M" + points.map((p) => `${p.x} ${p.y}`).join(" L") + " Z";
  }, []);

  const generateSpline = useCallback(
    (points: Point[]): string => {
      if (points.length < 3) return generatePolyline(points);
      let d = `M ${points[0].x} ${points[0].y}`;
      const n = points.length;
      for (let i = 0; i < n; i++) {
        const p0 = points[(i - 1 + n) % n],
          p1 = points[i],
          p2 = points[(i + 1) % n],
          p3 = points[(i + 2) % n];
        const cp1x = p1.x + (p2.x - p0.x) / 6,
          cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6,
          cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(
          2
        )} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      }
      return d;
    },
    [generatePolyline]
  );

  const generateTrack = useCallback(() => {
    const currentTrackLanes = trackLanesRef.current;

    if (!pathElement.current || points.length < 2) {
      setTrackLanes(() => []);
      setPathData("");
      return;
    }
    const isDrawnClockwise = points.length > 2 && isClockwise(points);
    const directionMultiplier = isDrawnClockwise ? -1 : 1;
    const newPathData = generateSpline(points);
    pathElement.current.setAttribute("d", newPathData);
    setPathData(newPathData);
    const totalLength = pathElement.current.getTotalLength();
    if (totalLength === 0) return;
    const numSegments = Math.floor(totalLength / segmentLength);
    const actualSegmentLength = totalLength / numSegments;
    const pathCache = new Map<number, PathCacheEntry>();
    for (let s = 0; s < numSegments; s++) {
      for (let i = 0; i <= edgeResolution; i++) {
        const dist =
          s * actualSegmentLength + (i / edgeResolution) * actualSegmentLength;
        if (pathCache.has(dist)) continue;
        const p_before = pathElement.current.getPointAtLength(
          (dist - 0.1 + totalLength) % totalLength
        );
        const p_after = pathElement.current.getPointAtLength(
          (dist + 0.1) % totalLength
        );
        const angle = Math.atan2(
          p_after.y - p_before.y,
          p_after.x - p_before.x
        );
        const normalAngle = angle + Math.PI / 2;
        const point = pathElement.current.getPointAtLength(dist);
        pathCache.set(dist, { point, normalAngle });
      }
    }
    const zones: { lane: number; merge: any; split: any }[] = [];
    if (currentTrackLanes.length > 0) {
      currentTrackLanes.forEach((lane, l_idx) => {
        const mergeSeg = lane.find(
          (s) => s.mergeType === "merge" && s.span > 0
        );
        const splitSeg = lane.find(
          (s) => s.mergeType === "split" && s.span > 0
        );
        if (mergeSeg && splitSeg) {
          const [, s_m] = mergeSeg.id
            .replace("l", "")
            .replace("s", "")
            .split("-")
            .map(Number);
          const [, s_s] = splitSeg.id
            .replace("l", "")
            .replace("s", "")
            .split("-")
            .map(Number);
          zones.push({
            lane: l_idx,
            merge: {
              start: s_m,
              end: (s_m + mergeSeg.span - 1) % numSegments,
              span: mergeSeg.span,
            },
            split: {
              start: s_s,
              end: (s_s + splitSeg.span - 1) % numSegments,
              span: splitSeg.span,
            },
          });
        }
      });
    }
    const newLanes: TrackLanes = [];
    const centerOffset = (numberOfLanes - 1) / 2;
    for (let l = 0; l < numberOfLanes; l++) {
      const lane: Lane = [];
      const myZone = zones.find((z) => z.lane === l);
      for (let s = 0; s < numSegments; s++) {
        const innerPoints: Point[] = [];
        const outerPoints: Point[] = [];
        for (let i = 0; i <= edgeResolution; i++) {
          const pointProgress = i / edgeResolution;
          let currentWidth = laneWidth;
          let totalShift = 0;
          if (myZone) {
            const { merge, split } = myZone;
            const isBetween =
              (split.start < merge.start &&
                s >= split.start &&
                s <= merge.end) ||
              (split.start > merge.start &&
                (s >= split.start || s <= merge.end));
            if (isBetween) {
              if (s >= split.start && s <= split.end)
                currentWidth =
                  laneWidth * ((s - split.start + pointProgress) / split.span);
              else if (s >= merge.start && s <= merge.end)
                currentWidth =
                  laneWidth *
                  (1 - (s - merge.start + pointProgress) / merge.span);
            } else currentWidth = 0;
          }
          for (const zone of zones) {
            if (l === zone.lane) continue;
            let shiftFactor = 0;
            const { merge, split } = zone;
            const isOtherActive =
              (split.start < merge.start &&
                s >= split.start &&
                s <= merge.end) ||
              (split.start > merge.start &&
                (s >= split.start || s <= merge.end));
            if (isOtherActive) {
              if (s >= split.start && s <= split.end)
                shiftFactor =
                  1 - (s - split.start + pointProgress) / split.span;
              else if (s >= merge.start && s <= merge.end)
                shiftFactor = (s - merge.start + pointProgress) / merge.span;
            } else shiftFactor = 1;
            if (shiftFactor > 0)
              totalShift +=
                (l < zone.lane ? 1 : -1) * (laneWidth / 2) * shiftFactor;
          }
          const laneCenter = (l - centerOffset) * laneWidth + totalShift;
          const innerOffset = laneCenter - currentWidth / 2;
          const outerOffset = laneCenter + currentWidth / 2;
          const currentDist =
            s * actualSegmentLength +
            (i / edgeResolution) * actualSegmentLength;
          const { point, normalAngle } = pathCache.get(currentDist)!;
          innerPoints.push({
            x:
              point.x +
              innerOffset * directionMultiplier * Math.cos(normalAngle),
            y:
              point.y +
              innerOffset * directionMultiplier * Math.sin(normalAngle),
          });
          outerPoints.push({
            x:
              point.x +
              outerOffset * directionMultiplier * Math.cos(normalAngle),
            y:
              point.y +
              outerOffset * directionMultiplier * Math.sin(normalAngle),
          });
        }
        const isSquashed = innerPoints.every(
          (p, i) =>
            Math.hypot(p.x - outerPoints[i].x, p.y - outerPoints[i].y) < 0.1
        );
        const currentSegment = currentTrackLanes[l]?.[s];
        lane.push({
          id: `l${l}-s${s}`,
          points: { inner: innerPoints, outer: outerPoints },
          type: currentSegment?.type || "normal",
          span: currentSegment?.span ?? 1,
          isCap: currentSegment?.isCap || false,
          mergeType: currentSegment?.mergeType || null,
          visible: currentSegment?.visible ?? true,
          isSquashed: isSquashed,
          data: currentSegment?.data ?? null,
        });
      }
      newLanes.push(lane);
    }
    setTrackLanes(() => newLanes);
  }, [points, numberOfLanes, generateSpline, isClockwise, setTrackLanes]);

  useEffect(() => {
    if (mode === "editing") {
      generateTrack();
    }
  }, [mode, points, numberOfLanes, generateTrack, trackGeometrySignature]);

  useEffect(() => {
    setSegmentDataInput(selectedSegment?.data?.toString() ?? "");
  }, [selectedSegment]);

  const handleSvgClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (
        mode !== "drawing" ||
        event.button !== 0 ||
        event.altKey ||
        !svgElement.current
      )
        return;
      const pt = svgElement.current.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svgElement.current.getScreenCTM();
      if (ctm) {
        const { x, y } = pt.matrixTransform(ctm.inverse());
        setPoints((p) => [...p, { x, y }]);
      }
    },
    [mode]
  );
  const handleGenerateClick = useCallback(() => {
    setMode("editing");
  }, []);
  const handleSegmentClick = (laneIndex: number, segmentIndex: number) => {
    setSelectedSegmentId(`l${laneIndex}-s${segmentIndex}`);
  };
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!svgElement.current) return;
      const zoomFactor = 1.15;
      const { clientX, clientY, deltaY } = event;
      const pt = svgElement.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svgElement.current.getScreenCTM();
      if (ctm) {
        const mousePos = pt.matrixTransform(ctm.inverse());
        const newWidth =
          deltaY < 0 ? viewBox.width / zoomFactor : viewBox.width * zoomFactor;
        const newHeight =
          deltaY < 0
            ? viewBox.height / zoomFactor
            : viewBox.height * zoomFactor;
        setViewBox((prev) => ({
          width: newWidth,
          height: newHeight,
          x: mousePos.x - (mousePos.x - prev.x) * (newWidth / prev.width),
          y: mousePos.y - (mousePos.y - prev.y) * (newHeight / prev.height),
        }));
      }
    },
    [viewBox.width, viewBox.height]
  );
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 1 && !(event.button === 0 && event.altKey)) return;
      setIsPanning(true);
      setPanStart({ x: event.clientX, y: event.clientY });
      if (event.currentTarget instanceof HTMLElement)
        event.currentTarget.style.cursor = "grabbing";
    },
    []
  );
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanning || !svgElement.current) return;
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      const scale =
        viewBox.width / svgElement.current.getBoundingClientRect().width;
      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx * scale,
        y: prev.y - dy * scale,
      }));
      setPanStart({ x: event.clientX, y: event.clientY });
    },
    [isPanning, panStart, viewBox.width]
  );
  const handleMouseUpOrLeave = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setIsPanning(false);
      if (event.currentTarget instanceof HTMLElement)
        event.currentTarget.style.cursor = "default";
    },
    []
  );
  const reset = useCallback(() => {
    setPoints([]);
    setTrackLanes(() => []);
    setSelectedSegmentId(null);
    setPathData("");
    setMode("drawing");
    setViewBox({ x: 0, y: 0, width: 1000, height: 700 });
  }, [setTrackLanes]);
  const setSegmentType = useCallback(
    (type: SegmentType) => {
      if (!selectedSegment) return;
      const dataRequired = ["grid", "pit", "corner"];
      if (
        dataRequired.includes(type) &&
        String(segmentDataInput).trim() === ""
      ) {
        alert(`Please enter data before assigning type '${type}'.`);
        return;
      }
      setTrackLanes((draft) => {
        const [l, s] = selectedSegment.id
          .replace("l", "")
          .replace("s", "")
          .split("-")
          .map(Number);
        const seg = draft[l][s];
        seg.type = type;
        seg.data = dataRequired.includes(type)
          ? Number(segmentDataInput)
          : null;
      });
    },
    [selectedSegment, segmentDataInput, setTrackLanes]
  );
  const mergeWithNext = useCallback(() => {
    if (!selectedSegment) return;
    setTrackLanes((draft) => {
      const [l, s] = selectedSegment.id
        .replace("l", "")
        .replace("s", "")
        .split("-")
        .map(Number);
      const currentLane = draft[l];
      const seg = currentLane[s];
      const nextSegmentIndex = (s + seg.span) % currentLane.length;
      const nextSegment = currentLane[nextSegmentIndex];
      if (nextSegment && nextSegment.span > 0) {
        seg.span += nextSegment.span;
        nextSegment.span = 0;
      }
    });
  }, [selectedSegment, setTrackLanes]);
  const splitSegment = useCallback(() => {
    if (!selectedSegment || selectedSegment.span <= 1) return;
    setTrackLanes((draft) => {
      const [l, s] = selectedSegment.id
        .replace("l", "")
        .replace("s", "")
        .split("-")
        .map(Number);
      const currentLane = draft[l];
      const seg = currentLane[s];
      for (let i = 1; i < seg.span; i++) {
        currentLane[(s + i) % currentLane.length].span = 1;
      }
      seg.span = 1;
    });
  }, [selectedSegment, setTrackLanes]);
  const toggleCap = useCallback(() => {
    if (!selectedSegment) return;
    setTrackLanes((draft) => {
      const [l, s] = selectedSegment.id
        .replace("l", "")
        .replace("s", "")
        .split("-")
        .map(Number);
      const lane = draft[l];
      lane[s].isCap = !lane[s].isCap;
      const capIndices = lane
        .map((seg, i) => (seg.isCap ? i : -1))
        .filter((i) => i !== -1);
      if (capIndices.length === 2) {
        let inActiveZone = false;
        for (let i = 0; i < lane.length; i++) {
          const currentIndex = (capIndices[0] + i) % lane.length;
          const segment = lane[currentIndex];
          if (segment.isCap) {
            inActiveZone = !inActiveZone;
          }
          segment.visible = inActiveZone;
        }
      } else {
        lane.forEach((segment) => (segment.visible = true));
      }
    });
  }, [selectedSegment, setTrackLanes]);
  const setMergeMarker = useCallback(
    (type: "merge" | "split") => {
      if (!selectedSegment) return;
      setTrackLanes((draft) => {
        const [l, s] = selectedSegment.id
          .replace("l", "")
          .replace("s", "")
          .split("-")
          .map(Number);
        const seg = draft[l][s];
        seg.mergeType = seg.mergeType === type ? null : type;
      });
    },
    [selectedSegment, setTrackLanes]
  );

  const exportSVG = useCallback(() => {
    if (!svgElement.current) return;
    const visiblePolygons = svgElement.current.querySelectorAll(
      "polygon.segment:not(.out-of-bounds)"
    );
    if (visiblePolygons.length === 0) {
      alert("There is no track to export!");
      return;
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    visiblePolygons.forEach((poly) => {
      const bbox = (poly as SVGPolygonElement).getBBox();
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });
    const padding = 20;
    const finalWidth = maxX - minX + padding * 2;
    const finalHeight = maxY - minY + padding * 2;
    const finalViewBox = `${minX - padding} ${
      minY - padding
    } ${finalWidth} ${finalHeight}`;
    const svgClone = svgElement.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute("width", String(finalWidth));
    svgClone.setAttribute("height", String(finalHeight));
    svgClone.setAttribute("viewBox", finalViewBox);
    svgClone.removeAttribute("style");
    svgClone
      .querySelectorAll(".guide-element, #centerline")
      .forEach((el) => el.remove());
    const originalPolygons =
      svgElement.current.querySelectorAll("polygon.segment");
    const clonedPolygons = svgClone.querySelectorAll("polygon.segment");
    clonedPolygons.forEach((poly, index) => {
      const originalPoly = originalPolygons[index];
      if (originalPoly) {
        const computedStyle = window.getComputedStyle(originalPoly);
        poly.setAttribute("fill", computedStyle.getPropertyValue("fill"));
        poly.setAttribute("stroke", "#333");
        poly.setAttribute("stroke-width", "1");
        poly.setAttribute("stroke-dasharray", "none");
        poly.removeAttribute("class");
      }
    });
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "track.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const exportJSON = useCallback(() => {
    if (trackLanes.length === 0 || trackLanes[0].length === 0) {
      alert("There is no track data to export!");
      return;
    }
    const isDrawnClockwise = points.length > 2 && isClockwise(points);
    const numLanes = trackLanes.length;
    const numSegments = trackLanes[0].length;
    const segmentMap = new Map();
    for (let l = 0; l < numLanes; l++) {
      for (let s = 0; s < numSegments; s++) {
        const segment = trackLanes[l][s];
        if (segment.span > 0 && segment.visible) {
          const isOOB = segment.type === "out-of-bounds" || segment.isSquashed;
          segmentMap.set(segment.id, {
            id: segment.id,
            type: isOOB ? "out-of-bounds" : segment.type,
            lane: l,
            index: s,
            span: segment.span,
            data: isOOB ? null : segment.data,
            connections: {},
          });
        }
      }
    }
    const findDiagonalTarget = (
      startLane: number,
      segmentIdx: number,
      laneOffset: number
    ): string | null => {
      let currentLane = startLane + laneOffset;
      while (currentLane >= 0 && currentLane < numLanes) {
        const targetSegment = trackLanes[currentLane]?.[segmentIdx];
        if (!targetSegment) return null;
        if (
          targetSegment.visible &&
          !targetSegment.isSquashed &&
          targetSegment.type !== "out-of-bounds"
        ) {
          return targetSegment.id;
        }
        if (!targetSegment.isSquashed) {
          return null;
        }
        currentLane += laneOffset;
      }
      return null;
    };
    const finalSegments: any[] = [];
    for (const segment of segmentMap.values()) {
      if (segment.type === "out-of-bounds") {
        continue;
      }

      const next_s = (segment.index + segment.span) % numSegments;
      const nextIdInLane = `l${segment.lane}-s${next_s}`;
      const nextSegmentInMap = segmentMap.get(nextIdInLane);
      segment.connections.next =
        nextSegmentInMap && nextSegmentInMap.type !== "out-of-bounds"
          ? nextIdInLane
          : null;
      const innerLaneOffset = -1;
      const outerLaneOffset = +1;

      const targetInnerId = findDiagonalTarget(
        segment.lane,
        next_s,
        innerLaneOffset
      );
      const targetOuterId = findDiagonalTarget(
        segment.lane,
        next_s,
        outerLaneOffset
      );

      if (isDrawnClockwise) {
        segment.connections.diag_right = targetInnerId;
        segment.connections.diag_left = targetOuterId;
      } else {
        segment.connections.diag_left = targetInnerId;
        segment.connections.diag_right = targetOuterId;
      }

      delete segment.span;
      finalSegments.push(segment);
    }
    const gameData = {
      meta: {
        lanes: numLanes,
        segmentsPerLane: numSegments,
        direction: isDrawnClockwise ? "clockwise" : "counter-clockwise",
      },
      segments: finalSegments,
    };
    const jsonString = JSON.stringify(gameData, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "track-data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [trackLanes, points, isClockwise]);

  const importSVG = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const svgText = e.target?.result as string;
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

          const polygons = svgDoc.querySelectorAll("polygon");
          if (polygons.length === 0) {
            alert("No track segments found in SVG file!");
            return;
          }

          // Extract all polygon points and organize by segment
          const segmentData: Map<
            string,
            { points: string; fill: string; stroke: string }
          > = new Map();

          polygons.forEach((poly) => {
            const points = poly.getAttribute("points") || "";
            const fill = poly.getAttribute("fill") || "";
            const stroke = poly.getAttribute("stroke") || "";

            // Generate a unique key based on the centroid of points
            const pointsArray = points
              .split(" ")
              .map((p) => {
                const [x, y] = p.split(",").map(Number);
                return { x, y };
              })
              .filter((p) => !isNaN(p.x) && !isNaN(p.y));

            if (pointsArray.length > 0) {
              const centroidX =
                pointsArray.reduce((sum, p) => sum + p.x, 0) /
                pointsArray.length;
              const centroidY =
                pointsArray.reduce((sum, p) => sum + p.y, 0) /
                pointsArray.length;
              const key = `${Math.round(centroidX)},${Math.round(centroidY)}`;
              segmentData.set(key, { points, fill, stroke });
            }
          });

          // Find the approximate centerline by averaging all polygon points
          const allPoints: Point[] = [];
          segmentData.forEach((data) => {
            const points = data.points
              .split(" ")
              .map((p) => {
                const [x, y] = p.split(",").map(Number);
                return { x, y };
              })
              .filter((p) => !isNaN(p.x) && !isNaN(p.y));
            allPoints.push(...points);
          });

          if (allPoints.length === 0) {
            alert("Could not extract valid points from SVG!");
            return;
          }

          // Compute rough centerline by sampling unique centroids
          const centroids: Point[] = [];
          segmentData.forEach((data) => {
            const points = data.points
              .split(" ")
              .map((p) => {
                const [x, y] = p.split(",").map(Number);
                return { x, y };
              })
              .filter((p) => !isNaN(p.x) && !isNaN(p.y));

            if (points.length > 0) {
              const cx =
                points.reduce((sum, p) => sum + p.x, 0) / points.length;
              const cy =
                points.reduce((sum, p) => sum + p.y, 0) / points.length;
              centroids.push({ x: cx, y: cy });
            }
          });

          // Sort centroids to form a rough path (simple nearest-neighbor)
          const sortedCentroids: Point[] = [];
          const remaining = [...centroids];
          let current = remaining[0];
          sortedCentroids.push(current);
          remaining.splice(0, 1);

          while (remaining.length > 0) {
            let nearestIdx = 0;
            let nearestDist = Infinity;

            for (let i = 0; i < remaining.length; i++) {
              const dist = Math.hypot(
                remaining[i].x - current.x,
                remaining[i].y - current.y
              );
              if (dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
              }
            }

            current = remaining[nearestIdx];
            sortedCentroids.push(current);
            remaining.splice(nearestIdx, 1);
          }

          // Simplify to about 8-12 control points for the spline
          const step = Math.max(1, Math.floor(sortedCentroids.length / 10));
          const simplifiedPoints: Point[] = [];
          for (let i = 0; i < sortedCentroids.length; i += step) {
            simplifiedPoints.push(sortedCentroids[i]);
          }

          if (simplifiedPoints.length < 3) {
            alert("Not enough points to reconstruct track path!");
            return;
          }

          // Estimate number of lanes from the number of segments
          const estimatedLanes = Math.max(
            1,
            Math.floor(Math.sqrt(polygons.length / 10))
          );

          // Set the extracted data
          setPoints(simplifiedPoints);
          setNumberOfLanes(Math.min(12, estimatedLanes));
          setMode("drawing");

          // Auto-calculate viewBox to fit the track
          const minX = Math.min(...allPoints.map((p) => p.x));
          const minY = Math.min(...allPoints.map((p) => p.y));
          const maxX = Math.max(...allPoints.map((p) => p.x));
          const maxY = Math.max(...allPoints.map((p) => p.y));
          const padding = 100;

          setViewBox({
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
          });

          alert(
            `Track loaded! ${simplifiedPoints.length} control points extracted. Click "Generate Track" to recreate it.`
          );
        } catch (error) {
          console.error("Error parsing SVG:", error);
          alert(
            "Error loading SVG file. Please ensure it's a valid SVG created by this tool."
          );
        }
      };

      reader.readAsText(file);
      event.target.value = ""; // Reset input
    },
    []
  );

  return (
    <div className="track-designer-wrapper">
      <div className="controls">
        <h2>Track Designer</h2>
        {mode === "drawing" ? (
          <>
            <div className="control-group">
              <h3>1. Draw Track Path</h3>
              <p>
                Click on the canvas to add points. Use the <b>Mouse Wheel</b> to
                zoom and <b>Alt+Drag</b> or <b>Middle-Click Drag</b> to pan.
              </p>
            </div>
            <div className="control-group">
              <h3>2. Set Lanes</h3>
              <label>
                {" "}
                Number of Lanes:{" "}
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={numberOfLanes}
                  onChange={(e) => setNumberOfLanes(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="control-group">
              <h3>3. Create Track</h3>
              <p>
                Once your path and lanes are set, generate the track to begin
                editing.
              </p>
              <button
                onClick={handleGenerateClick}
                disabled={points.length < 3}
              >
                Generate Track
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="control-group">
              <h3>1. Edit Selected Segment</h3>
              {selectedSegment ? (
                <>
                  <p>
                    <b>Selected:</b> {selectedSegment.id}
                  </p>
                  <h4>Data</h4>
                  <input
                    type="number"
                    value={segmentDataInput}
                    onChange={(e) => setSegmentDataInput(e.target.value)}
                    placeholder="Player # or Speed"
                    style={{ width: "calc(100% - 18px)", marginBottom: "10px" }}
                  />
                  <p className="help-text">
                    Enter Player # for Grid/Pit, or Safety Speed for Corner.
                  </p>
                  <h4>Assign Type</h4>
                  <div className="type-buttons">
                    <button
                      onClick={() => setSegmentType("normal")}
                      className={
                        selectedSegment.type === "normal" ? "active" : ""
                      }
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setSegmentType("grid")}
                      className={
                        selectedSegment.type === "grid" ? "active" : ""
                      }
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => setSegmentType("pit")}
                      className={selectedSegment.type === "pit" ? "active" : ""}
                    >
                      Pit
                    </button>
                    <button
                      onClick={() => setSegmentType("corner")}
                      className={
                        selectedSegment.type === "corner" ? "active" : ""
                      }
                    >
                      Corner
                    </button>
                    <button
                      onClick={() => setSegmentType("finish")}
                      className={
                        selectedSegment.type === "finish" ? "active" : ""
                      }
                    >
                      Finish
                    </button>
                    <button
                      onClick={() => setSegmentType("out-of-bounds")}
                      className={
                        selectedSegment.type === "out-of-bounds" ? "active" : ""
                      }
                    >
                      Wall
                    </button>
                  </div>
                  <h4>Actions</h4>
                  <div className="action-buttons">
                    <button
                      onClick={mergeWithNext}
                      disabled={selectedSegment.span === 0}
                    >
                      Merge Next
                    </button>
                    <button
                      onClick={splitSegment}
                      disabled={selectedSegment.span <= 1}
                    >
                      Split
                    </button>
                    <button
                      onClick={toggleCap}
                      className={selectedSegment.isCap ? "active" : ""}
                    >
                      Toggle Cap
                    </button>
                    <button
                      onClick={() => setMergeMarker("merge")}
                      className={
                        selectedSegment?.mergeType === "merge" ? "active" : ""
                      }
                    >
                      Mark as Merge
                    </button>
                    <button
                      onClick={() => setMergeMarker("split")}
                      className={
                        selectedSegment?.mergeType === "split" ? "active" : ""
                      }
                    >
                      Mark as Split
                    </button>
                  </div>
                  <p className="help-text">
                    Use 'Mark as Merge' and 'Mark as Split' on segments in the
                    same lane to create a lane drop.
                  </p>
                </>
              ) : (
                <p>Click on a segment on the canvas to select it.</p>
              )}
            </div>
            <div className="control-group">
              <h3>2. Export</h3>
              <div className="export-buttons">
                <button onClick={exportSVG}>Export SVG</button>
                <button onClick={exportJSON}>Export JSON</button>
              </div>
            </div>
          </>
        )}
        <hr />
        <button className="import-button">
          <label htmlFor="import-svg" style={{ cursor: "pointer" }}>
            Import SVG
            <input
              type="file"
              id="import-svg"
              accept=".svg"
              onChange={importSVG}
              style={{ display: "none" }}
            />
          </label>
        </button>
        <button onClick={reset} className="reset-button">
          {mode === "drawing" ? "Reset Path" : "Start Over"}
        </button>
      </div>
      <div
        className="canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <svg ref={svgElement} onClick={handleSvgClick} viewBox={viewBoxString}>
          <defs>
            <pattern
              id="checkerboard"
              patternUnits="userSpaceOnUse"
              width="12"
              height="12"
            >
              <rect width="12" height="12" fill="#f0f0f0" />
              <rect width="6" height="6" fill="#333" />
              <rect x="6" y="6" width="6" height="6" fill="#333" />
            </pattern>
          </defs>
          <path
            id="centerline"
            ref={pathElement}
            d={pathData}
            fill="none"
            stroke="none"
          />
          {mode === "drawing" && points.length > 0 && (
            <>
              <path
                className="guide-element"
                d={generatePolyline(points)}
                fill="rgba(255, 0, 0, 0.05)"
                stroke="rgba(255, 0, 0, 0.5)"
                strokeWidth="2"
                strokeDasharray="4"
                style={{ vectorEffect: "non-scaling-stroke" }}
              />
              {points.map((point, i) => (
                <React.Fragment key={i}>
                  <circle
                    className="guide-element"
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill="red"
                    style={{ vectorEffect: "non-scaling-stroke" }}
                  />
                  <text
                    className="guide-element"
                    x={point.x + 8}
                    y={point.y + 5}
                    fill="red"
                    fontSize="12"
                    fontWeight="bold"
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      vectorEffect: "non-scaling-stroke",
                    }}
                  >
                    {i + 1}
                  </text>
                </React.Fragment>
              ))}
            </>
          )}
          {mode === "editing" && (
            <g style={{ vectorEffect: "non-scaling-stroke" }}>
              {trackLanes.map((lane, l) =>
                lane.map((segment, s) => (
                  <TrackSegment
                    key={segment.id}
                    segment={segment}
                    lane={lane}
                    segmentIndex={s}
                    isSelected={segment.id === selectedSegmentId}
                    onClick={() => handleSegmentClick(l, s)}
                  />
                ))
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default TrackDesigner;
