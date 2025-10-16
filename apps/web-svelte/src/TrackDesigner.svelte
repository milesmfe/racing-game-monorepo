<script>
  let segmentLength = 40;
  let laneWidth = 30;
  let edgeResolution = 15;
  const playerColors = {
    0: "#ffc107",
    1: "#dc3545",
    2: "#007bff",
    3: "#28a745",
    4: "#fd7e14",
    5: "#6c757d",
    6: "#17a2b8",
    7: "#6610f2",
  };
  let mode = "drawing";
  let points = [];
  let numberOfLanes = 4;
  let trackLanes = [];
  let selectedSegmentId = null;
  let segmentDataInput = "";

  let svgElement;
  let pathElement;
  let pathData = "";
  let viewBox = { x: 0, y: 0, width: 1000, height: 700 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  $: viewBoxString = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  $: if (mode === "editing") {
    generateTrack();
  }

  $: if (trackLanes.length > 0) {
    updateSegmentVisibility();
  }

  $: selectedSegment = (() => {
    if (!selectedSegmentId) return null;
    const [l, s] = selectedSegmentId
      .replace("l", "")
      .replace("s", "")
      .split("-")
      .map(Number);
    if (trackLanes[l] && trackLanes[l][s]) {
      return trackLanes[l][s];
    }
    return null;
  })();
  $: segmentDataInput = selectedSegment?.data?.toString() ?? "";

  function generateTrack() {
    if (!pathElement || points.length < 2) {
      trackLanes = [];
      pathData = "";
      return;
    }

    const isDrawnClockwise = points.length > 2 && isClockwise(points);
    const directionMultiplier = isDrawnClockwise ? -1 : 1;

    pathData = generateSpline(points);
    pathElement.setAttribute("d", pathData);

    const totalLength = pathElement.getTotalLength();
    if (totalLength === 0) return;

    const numSegments = Math.floor(totalLength / segmentLength);
    const actualSegmentLength = totalLength / numSegments;
    const zones = [];
    if (trackLanes.length > 0) {
      trackLanes.forEach((lane, l_idx) => {
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

    const newLanes = [];
    const centerOffset = (numberOfLanes - 1) / 2;
    for (let l = 0; l < numberOfLanes; l++) {
      const lane = [];
      const myZone = zones.find((z) => z.lane === l);
      for (let s = 0; s < numSegments; s++) {
        const innerPoints = [];
        const outerPoints = [];
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
          innerPoints.push(
            getOffsetPoint(
              currentDist,
              innerOffset * directionMultiplier,
              totalLength
            )
          );
          outerPoints.push(
            getOffsetPoint(
              currentDist,
              outerOffset * directionMultiplier,
              totalLength
            )
          );
        }
        const isSquashed = innerPoints.every(
          (p, i) =>
            Math.hypot(p.x - outerPoints[i].x, p.y - outerPoints[i].y) < 0.1
        );
        const currentSegment = trackLanes[l]?.[s];
        lane.push({
          id: `l${l}-s${s}`,
          points: { inner: innerPoints, outer: outerPoints },
          type: currentSegment?.type || "normal",
          span: currentSegment?.span ?? 1,
          isCap: currentSegment?.isCap || false,
          mergeType: currentSegment?.mergeType || null,
          visible: true,
          isSquashed: isSquashed,
          data: currentSegment?.data ?? null,
        });
      }
      newLanes.push(lane);
    }
    trackLanes = newLanes;
  }

  function getOffsetPoint(dist, offset, totalLength) {
    const p_before = pathElement.getPointAtLength(
      (dist - 0.1 + totalLength) % totalLength
    );
    const p_after = pathElement.getPointAtLength((dist + 0.1) % totalLength);
    const angle = Math.atan2(p_after.y - p_before.y, p_after.x - p_before.x);
    const normalAngle = angle + Math.PI / 2;
    const centerPoint = pathElement.getPointAtLength(dist);
    return {
      x: centerPoint.x + offset * Math.cos(normalAngle),
      y: centerPoint.y + offset * Math.sin(normalAngle),
    };
  }

  function updateSegmentVisibility() {
    trackLanes.forEach((lane) => {
      const capIndices = lane
        .map((s, i) => (s.isCap ? i : -1))
        .filter((i) => i !== -1);
      if (capIndices.length === 2) {
        let inActiveZone = false;
        for (let i = 0; i < lane.length; i++) {
          const currentIndex = (capIndices[0] + i) % lane.length;
          const segment = lane[currentIndex];
          if (segment.isCap) inActiveZone = !inActiveZone;
          segment.visible = inActiveZone;
        }
      } else lane.forEach((segment) => (segment.visible = true));
    });
    trackLanes = [...trackLanes];
  }

  function handleSvgClick(event) {
    if (mode !== "drawing" || event.button !== 0 || event.altKey) return;
    const pt = svgElement.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const { x, y } = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    points = [...points, { x, y }];
  }
  function handleGenerateClick() {
    generateTrack();
    mode = "editing";
  }
  function handleSegmentClick(laneIndex, segmentIndex) {
    selectedSegmentId = `l${laneIndex}-s${segmentIndex}`;
  }
  function handleWheel(event) {
    event.preventDefault();
    const zoomFactor = 1.15;
    const { clientX, clientY, deltaY } = event;
    const pt = svgElement.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const mousePos = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    let newWidth =
      deltaY < 0 ? viewBox.width / zoomFactor : viewBox.width * zoomFactor;
    let newHeight =
      deltaY < 0 ? viewBox.height / zoomFactor : viewBox.height * zoomFactor;
    viewBox.x =
      mousePos.x - (mousePos.x - viewBox.x) * (newWidth / viewBox.width);
    viewBox.y =
      mousePos.y - (mousePos.y - viewBox.y) * (newHeight / viewBox.height);
    viewBox.width = newWidth;
    viewBox.height = newHeight;
  }
  function handleMouseDown(event) {
    if (event.button !== 1 && !(event.button === 0 && event.altKey)) return;
    isPanning = true;
    panStart = { x: event.clientX, y: event.clientY };
    svgElement.style.cursor = "grabbing";
  }
  function handleMouseMove(event) {
    if (!isPanning) return;
    const dx = event.clientX - panStart.x,
      dy = event.clientY - panStart.y;
    const scale = viewBox.width / svgElement.getBoundingClientRect().width;
    viewBox.x -= dx * scale;
    viewBox.y -= dy * scale;
    panStart = { x: event.clientX, y: event.clientY };
  }
  function handleMouseUpOrLeave() {
    isPanning = false;
    svgElement.style.cursor = "default";
  }
  function setSegmentType(type) {
    if (!selectedSegment) return;
    const dataRequired = ["grid", "pit", "corner"];
    if (dataRequired.includes(type)) {
      if (String(segmentDataInput).trim() === "") {
        alert(`Please enter data before assigning type '${type}'.`);
        return;
      }
      selectedSegment.data = Number(String(segmentDataInput));
    } else {
      selectedSegment.data = null;
    }
    selectedSegment.type = type;
    trackLanes = [...trackLanes];
  }
  function mergeWithNext() {
    if (!selectedSegment) return;
    const [l, s] = selectedSegment.id
      .replace("l", "")
      .replace("s", "")
      .split("-")
      .map(Number);
    const currentLane = trackLanes[l];
    const nextSegmentIndex = (s + selectedSegment.span) % currentLane.length;
    const nextSegment = currentLane[nextSegmentIndex];
    if (nextSegment && nextSegment.span > 0) {
      selectedSegment.span += nextSegment.span;
      nextSegment.span = 0;
      trackLanes = [...trackLanes];
    }
  }
  function splitSegment() {
    if (!selectedSegment || selectedSegment.span <= 1) return;
    const [l, s] = selectedSegment.id
      .replace("l", "")
      .replace("s", "")
      .split("-")
      .map(Number);
    for (let i = 1; i < selectedSegment.span; i++)
      trackLanes[l][(s + i) % trackLanes[l].length].span = 1;
    selectedSegment.span = 1;
    trackLanes = [...trackLanes];
  }
  function toggleCap() {
    if (!selectedSegment) return;
    selectedSegment.isCap = !selectedSegment.isCap;
    trackLanes = [...trackLanes];
  }
  function setMergeMarker(type) {
    if (!selectedSegment) return;
    selectedSegment.mergeType =
      selectedSegment.mergeType === type ? null : type;
    generateTrack();
  }
  function reset() {
    points = [];
    trackLanes = [];
    selectedSegmentId = null;
    pathData = "";
    mode = "drawing";
    viewBox = { x: 0, y: 0, width: 1000, height: 700 };
  }

  function exportSVG() {
    const visiblePolygons = svgElement.querySelectorAll(
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
      const bbox = poly.getBBox();
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
    const svgClone = svgElement.cloneNode(true);
    svgClone.setAttribute("width", finalWidth);
    svgClone.setAttribute("height", finalHeight);
    svgClone.setAttribute("viewBox", finalViewBox);
    svgClone.removeAttribute("style");
    svgClone
      .querySelectorAll(".guide-element, #centerline")
      .forEach((el) => el.remove());
    const originalPolygons = svgElement.querySelectorAll("polygon.segment");
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
  }

  function exportJSON() {
    if (trackLanes.length === 0 || trackLanes[0].length === 0) {
      alert("There is no track data to export!");
      return;
    }
    const isDrawnClockwise = points.length > 2 && isClockwise(points);
    const directionMultiplier = isDrawnClockwise ? -1 : 1;
    const numLanes = trackLanes.length;
    const numSegments = trackLanes[0].length;
    const segmentMap = new Map();
    const oobIds = new Set();
    for (let l = 0; l < numLanes; l++) {
      for (let s = 0; s < numSegments; s++) {
        const segment = trackLanes[l][s];
        if (!segment.visible) continue;
        const effectiveType =
          segment.isSquashed || segment.type === "out-of-bounds"
            ? "out-of-bounds"
            : segment.type;
        if (effectiveType === "out-of-bounds") oobIds.add(segment.id);
        segmentMap.set(segment.id, {
          id: segment.id,
          type: effectiveType,
          lane: l,
          index: s,
          span: segment.span,
          data: effectiveType === "out-of-bounds" ? null : segment.data,
          connections: {},
        });
      }
    }
    const finalSegments = [];
    for (const segment of segmentMap.values()) {
      if (segment.span === 0) continue;

      if (oobIds.has(segment.id)) {
        segment.connections = { next: null, diag_left: null, diag_right: null };
      } else {
        const next_s = (segment.index + segment.span) % numSegments;
        const next_id_raw = `l${segment.lane}-s${next_s}`;
        segment.connections.next =
          segmentMap.has(next_id_raw) && !oobIds.has(next_id_raw)
            ? next_id_raw
            : null;

        const left_l = segment.lane + directionMultiplier;
        const right_l = segment.lane - directionMultiplier;
        const diag_left_id_raw = `l${left_l}-s${next_s}`;
        const diag_right_id_raw = `l${right_l}-s${next_s}`;

        if (isDrawnClockwise) {
          segment.connections.diag_left =
            segmentMap.has(diag_left_id_raw) && !oobIds.has(diag_left_id_raw)
              ? diag_left_id_raw
              : null;
          segment.connections.diag_right =
            segmentMap.has(diag_right_id_raw) && !oobIds.has(diag_right_id_raw)
              ? diag_right_id_raw
              : null;
        } else {
          segment.connections.diag_left =
            segmentMap.has(diag_right_id_raw) && !oobIds.has(diag_right_id_raw)
              ? diag_right_id_raw
              : null;
          segment.connections.diag_right =
            segmentMap.has(diag_left_id_raw) && !oobIds.has(diag_left_id_raw)
              ? diag_left_id_raw
              : null;
        }
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
  }

  function isClockwise(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++)
      a +=
        (pts[(i + 1) % pts.length].x - pts[i].x) *
        (pts[(i + 1) % pts.length].y + pts[i].y);
    return a > 0;
  }
  function generatePolyline(points) {
    if (points.length < 1) return "";
    return "M" + points.map((p) => `${p.x} ${p.y}`).join(" L") + " Z";
  }
  function generateSpline(points) {
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
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }
  function toPointsString(points) {
    return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  }
  function calculateMergedPoints(lane, startIndex) {
    const startSegment = lane[startIndex];
    if (!startSegment || startSegment.isSquashed) return "";
    const fullInnerEdge = [],
      fullOuterEdge = [];
    for (let i = 0; i < startSegment.span; i++) {
      const s = lane[(startIndex + i) % lane.length];
      if (!s) continue;
      // TODO: Handle kinks in merged segments better
      const isLastSegmentInSpan = i === startSegment.span - 1;
      fullInnerEdge.push(
        ...(isLastSegmentInSpan ? s.points.inner : s.points.inner.slice(0, -1))
      );
      fullOuterEdge.push(
        ...(isLastSegmentInSpan ? s.points.outer : s.points.outer.slice(0, -1))
      );
    }
    return toPointsString([...fullInnerEdge, ...fullOuterEdge.reverse()]);
  }

  function getPolygonStyle(segment) {
    if (
      (segment.type === "grid" || segment.type === "pit") &&
      segment.data !== null
    ) {
      const color = playerColors[segment.data] || "#cccccc";
      return `fill: ${color};`;
    }
    return "";
  }
  function shouldDisplayText(segment) {
    return (
      (segment.type === "corner" ||
        segment.type === "grid" ||
        segment.type === "pit") &&
      segment.data !== null
    );
  }
  function getSegmentText(segment) {
    if (segment.type === "corner") return segment.data;
    if (segment.type === "grid" || segment.type === "pit")
      return Number(segment.data) + 1;
    return "";
  }
  function getSegmentMetrics(segment) {
    if (
      !segment ||
      !segment.points.inner.length ||
      !segment.points.outer.length
    )
      return null;
    const allPoints = [...segment.points.inner, ...segment.points.outer];
    let sumX = 0,
      sumY = 0;
    allPoints.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
    });
    let centerX = sumX / allPoints.length;
    let centerY = sumY / allPoints.length;
    const p_start = segment.points.inner[0];
    const p_end = segment.points.inner[segment.points.inner.length - 1];
    const directionAngle =
      Math.atan2(p_end.y - p_start.y, p_end.x - p_start.x) * (180 / Math.PI);
    const angle = directionAngle + 90;
    const width = Math.hypot(
      segment.points.outer[0].x - segment.points.inner[0].x,
      segment.points.outer[0].y - segment.points.inner[0].y
    );
    let fontSize = width * 0.5;
    if (segment.type === "grid") {
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
  }
</script>

<div class="track-creator-wrapper">
  <div class="controls">
    <h2>Track Creator</h2>

    {#if mode === "drawing"}
      <div class="control-group">
        <h3>1. Draw Track Path</h3>
        <p>
          Click on the canvas to add points. Use the <b>Mouse Wheel</b> to zoom
          and <b>Alt+Drag</b> or <b>Middle-Click Drag</b> to pan.
        </p>
      </div>
      <div class="control-group">
        <h3>2. Set Lanes</h3>
        <label>
          Number of Lanes:
          <input type="number" min="1" max="12" bind:value={numberOfLanes} />
        </label>
      </div>
      <div class="control-group">
        <h3>3. Create Track</h3>
        <p>
          Once your path and lanes are set, generate the track to begin editing.
        </p>
        <button on:click={handleGenerateClick} disabled={points.length < 3}>
          Generate Track
        </button>
      </div>
    {:else}
      <div class="control-group">
        <h3>1. Edit Selected Segment</h3>
        {#if selectedSegment}
          <p><b>Selected:</b> {selectedSegment.id}</p>
          <h4>Data</h4>
          <input
            type="number"
            bind:value={segmentDataInput}
            placeholder="Player # or Speed"
            style="width: calc(100% - 18px); margin-bottom: 10px;"
          />
          <p class="help-text">
            Enter Player # for Grid/Pit, or Safety Speed for Corner.
          </p>
          <h4>Assign Type</h4>
          <div class="type-buttons">
            <button
              on:click={() => setSegmentType("normal")}
              class:active={selectedSegment.type === "normal"}>Normal</button
            >
            <button
              on:click={() => setSegmentType("grid")}
              class:active={selectedSegment.type === "grid"}>Grid</button
            >
            <button
              on:click={() => setSegmentType("pit")}
              class:active={selectedSegment.type === "pit"}>Pit</button
            >
            <button
              on:click={() => setSegmentType("corner")}
              class:active={selectedSegment.type === "corner"}>Corner</button
            >
            <button
              on:click={() => setSegmentType("finish")}
              class:active={selectedSegment.type === "finish"}>Finish</button
            >
            <button
              on:click={() => setSegmentType("out-of-bounds")}
              class:active={selectedSegment.type === "out-of-bounds"}
              >Wall</button
            >
          </div>
          <h4>Actions</h4>
          <div class="action-buttons">
            <button
              on:click={mergeWithNext}
              disabled={selectedSegment.span === 0}>Merge Next</button
            >
            <button on:click={splitSegment} disabled={selectedSegment.span <= 1}
              >Split</button
            >
            <button on:click={toggleCap} class:active={selectedSegment.isCap}
              >Toggle Cap</button
            >
            <button
              on:click={() => setMergeMarker("merge")}
              class:active={selectedSegment?.mergeType === "merge"}
              >Mark as Merge</button
            >
            <button
              on:click={() => setMergeMarker("split")}
              class:active={selectedSegment?.mergeType === "split"}
              >Mark as Split</button
            >
          </div>
          <p class="help-text">
            Use 'Mark as Merge' and 'Mark as Split' on segments in the same lane
            to create a lane drop.
          </p>
        {:else}
          <p>Click on a segment on the canvas to select it.</p>
        {/if}
      </div>
      <div class="control-group">
        <h3>2. Export</h3>
        <div class="export-buttons">
          <button on:click={exportSVG}>Export SVG</button>
          <button on:click={exportJSON}>Export JSON</button>
        </div>
      </div>
    {/if}
    <hr />
    <button on:click={reset} class="reset-button">
      {#if mode === "drawing"}Reset Path{:else}Start Over{/if}
    </button>
  </div>

  <!-- Sorry for disabling these warnings :( I just don't know how to do ARIA support -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="canvas"
    on:wheel={handleWheel}
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUpOrLeave}
    on:mouseleave={handleMouseUpOrLeave}
  >
    <svg
      bind:this={svgElement}
      on:click={handleSvgClick}
      viewBox={viewBoxString}
    >
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
        bind:this={pathElement}
        d={pathData}
        fill="none"
        stroke="none"
      />
      {#if mode === "drawing" && points.length > 0}
        <path
          class="guide-element"
          d={generatePolyline(points)}
          fill="rgba(255, 0, 0, 0.05)"
          stroke="rgba(255, 0, 0, 0.5)"
          stroke-width="2"
          stroke-dasharray="4"
          style="vector-effect: non-scaling-stroke;"
        />
        {#each points as point, i}
          <circle
            class="guide-element"
            cx={point.x}
            cy={point.y}
            r="5"
            fill="red"
            style="vector-effect: non-scaling-stroke;"
          />
          <text
            class="guide-element"
            x={point.x + 8}
            y={point.y + 5}
            fill="red"
            font-size="12"
            font-weight="bold"
            style="user-select: none; -webkit-user-select: none; vector-effect: non-scaling-stroke;"
            >{i + 1}</text
          >
        {/each}
      {/if}

      {#if mode === "editing"}
        <g style="vector-effect: non-scaling-stroke;">
          {#each trackLanes as lane, l}
            {#each lane as segment, s}
              {#if segment.span > 0 && segment.visible && !segment.isSquashed}
                {@const metrics = getSegmentMetrics(segment)}
                <g class="segment-group">
                  <polygon
                    points={calculateMergedPoints(lane, s)}
                    class:segment={true}
                    class:normal={segment.type === "normal"}
                    class:corner={segment.type === "corner"}
                    class:finish={segment.type === "finish"}
                    class:out-of-bounds={segment.type === "out-of-bounds"}
                    class:selected={segment.id === selectedSegmentId}
                    class:cap={segment.isCap}
                    class:merge-marker={segment.mergeType === "merge"}
                    class:split-marker={segment.mergeType === "split"}
                    on:click|stopPropagation={() => handleSegmentClick(l, s)}
                    style={getPolygonStyle(segment)}
                  />
                  {#if metrics && shouldDisplayText(segment)}
                    <text
                      x={metrics.centerX}
                      y={metrics.centerY}
                      transform={`rotate(${metrics.angle}, ${metrics.centerX}, ${metrics.centerY})`}
                      font-size={metrics.fontSize}
                      font-family="sans-serif"
                      font-weight="bold"
                      text-anchor="middle"
                      dominant-baseline="central"
                      fill="white"
                      stroke="black"
                      stroke-width={metrics.fontSize * 0.05}
                      style="pointer-events: none; user-select: none;"
                    >
                      {getSegmentText(segment)}
                    </text>
                  {/if}
                </g>
              {/if}
            {/each}
          {/each}
        </g>
      {/if}
    </svg>
  </div>
</div>
