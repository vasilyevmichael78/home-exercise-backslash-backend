const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MAX_RENDERED_ROUTES = 100;
const SEVERITY_RANK = {
  unknown: 0,
  info: 1,
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

const form = document.querySelector("#filters-form");
const resetButton = document.querySelector("#reset-button");
const submitButton = document.querySelector("#submit-button");
const healthElement = document.querySelector("#health");
const routeCountElement = document.querySelector("#route-count");
const nodeCountElement = document.querySelector("#node-count");
const edgeCountElement = document.querySelector("#edge-count");
const graphContainer = document.querySelector("#graph-container");
const routeList = document.querySelector("#route-list");
const routeLimitNote = document.querySelector("#route-limit-note");
const warningsPanel = document.querySelector("#warnings-panel");
const warningsList = document.querySelector("#warnings-list");
const errorMessage = document.querySelector("#error-message");

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);

  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }

  return element;
}

function buildQuery() {
  const formData = new FormData(form);
  const query = new URLSearchParams();

  for (const filter of [
    "startsPublic",
    "endsInSink",
    "hasVulnerability",
  ]) {
    if (formData.has(filter)) {
      query.set(filter, "true");
    }
  }

  return query;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function renderWarnings(warnings) {
  warningsList.replaceChildren();

  if (!Array.isArray(warnings) || warnings.length === 0) {
    warningsPanel.classList.add("hidden");
    return;
  }

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    warningsList.append(item);
  }

  warningsPanel.classList.remove("hidden");
}

function getNodeSeverity(node) {
  if (!Array.isArray(node?.vulnerabilities) || node.vulnerabilities.length === 0) {
    return null;
  }

  const severities = node.vulnerabilities.map((vulnerability) => {
    const severity = String(vulnerability.severity ?? "unknown").toLowerCase();
    return severity in SEVERITY_RANK ? severity : "unknown";
  });

  return severities.reduce((highest, current) =>
    SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest,
  );
}

function getSeveritySummary(node) {
  if (!Array.isArray(node?.vulnerabilities)) {
    return "";
  }

  const severities = [
    ...new Set(
      node.vulnerabilities.map((vulnerability) =>
        String(vulnerability.severity ?? "unknown").toLowerCase(),
      ),
    ),
  ];

  return severities.join(", ");
}

function renderRoutes(routes, nodes) {
  routeList.replaceChildren();
  routeLimitNote.textContent = "";
  const nodesByName = new Map(nodes.map((node) => [node.name, node]));

  if (routes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No complete routes match the selected filters.";
    routeList.append(empty);
    return;
  }

  const visibleRoutes = routes.slice(0, MAX_RENDERED_ROUTES);

  for (const route of visibleRoutes) {
    const item = document.createElement("li");

    route.nodeIds.forEach((nodeId, index) => {
      const node = document.createElement("span");
      node.className = "route-node";
      const graphNode = nodesByName.get(nodeId);
      const severity = getNodeSeverity(graphNode);

      if (severity !== null) {
        node.classList.add(`severity-${severity}`);
        node.title = `${nodeId}: ${graphNode.vulnerabilities.length} vulnerability(s) · ${getSeveritySummary(graphNode)}`;
      }

      const nodeName = document.createElement("span");
      nodeName.textContent = nodeId;
      node.append(nodeName);

      if (severity !== null) {
        const badge = document.createElement("span");
        badge.className = "severity-badge";
        badge.textContent = severity;
        node.append(badge);
      }

      item.append(node);

      if (index < route.nodeIds.length - 1) {
        const arrow = document.createElement("span");
        arrow.className = "route-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "→";
        item.append(arrow);
      }
    });

    routeList.append(item);
  }

  if (routes.length > MAX_RENDERED_ROUTES) {
    routeLimitNote.textContent = `Showing first ${MAX_RENDERED_ROUTES} of ${routes.length}`;
  }
}

function calculateNodeLayers(routes, nodes) {
  const layers = new Map();

  for (const route of routes) {
    route.nodeIds.forEach((nodeId, index) => {
      const currentLayer = layers.get(nodeId);
      layers.set(nodeId, currentLayer === undefined ? index : Math.max(index, currentLayer));
    });
  }

  for (const node of nodes) {
    if (!layers.has(node.name)) {
      layers.set(node.name, 0);
    }
  }

  return layers;
}

function renderGraph(graph, routes) {
  graphContainer.replaceChildren();

  if (graph.nodes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No graph to display for the selected filters.";
    graphContainer.append(empty);
    return;
  }

  const nodeWidth = 190;
  const nodeHeight = 44;
  const columnGap = 90;
  const rowGap = 30;
  const padding = 36;
  const layers = calculateNodeLayers(routes, graph.nodes);
  const nodesByLayer = new Map();

  for (const node of graph.nodes) {
    const layer = layers.get(node.name) ?? 0;
    const layerNodes = nodesByLayer.get(layer) ?? [];
    layerNodes.push(node);
    nodesByLayer.set(layer, layerNodes);
  }

  const sortedLayers = [...nodesByLayer.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(...[...nodesByLayer.values()].map((nodes) => nodes.length));
  const width = Math.max(
    760,
    padding * 2 + sortedLayers.length * nodeWidth + (sortedLayers.length - 1) * columnGap,
  );
  const height = Math.max(
    340,
    padding * 2 + maxRows * nodeHeight + (maxRows - 1) * rowGap,
  );
  const positions = new Map();
  const svg = createSvgElement("svg", {
    class: "graph-svg",
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `Graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`,
  });

  const definitions = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: "arrowhead",
    markerWidth: 8,
    markerHeight: 8,
    refX: 7,
    refY: 4,
    orient: "auto",
  });
  marker.append(createSvgElement("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "#8fa0ad" }));
  definitions.append(marker);
  svg.append(definitions);

  sortedLayers.forEach((layer, layerIndex) => {
    const layerNodes = nodesByLayer.get(layer) ?? [];
    const columnHeight = layerNodes.length * nodeHeight + (layerNodes.length - 1) * rowGap;
    const startY = Math.max(padding, (height - columnHeight) / 2);

    layerNodes.forEach((node, rowIndex) => {
      positions.set(node.name, {
        x: padding + layerIndex * (nodeWidth + columnGap),
        y: startY + rowIndex * (nodeHeight + rowGap),
      });
    });
  });

  for (const edge of graph.edges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);

    if (source === undefined || target === undefined) {
      continue;
    }

    svg.append(
      createSvgElement("line", {
        class: "graph-edge",
        x1: source.x + nodeWidth,
        y1: source.y + nodeHeight / 2,
        x2: target.x,
        y2: target.y + nodeHeight / 2,
        "marker-end": "url(#arrowhead)",
      }),
    );
  }

  for (const node of graph.nodes) {
    const position = positions.get(node.name);

    if (position === undefined) {
      continue;
    }

    const classes = ["graph-node"];
    if (node.publicExposed === true) classes.push("public");
    const severity = getNodeSeverity(node);
    if (severity !== null) {
      classes.push(`severity-${severity}`);
    }
    if (["rds", "sql"].includes(String(node.kind).toLowerCase())) {
      classes.push("sink");
    }

    const group = createSvgElement("g", {
      class: classes.join(" "),
      transform: `translate(${position.x} ${position.y})`,
    });
    const title = createSvgElement("title");
    title.textContent =
      severity === null
        ? `${node.name} (${node.kind})`
        : `${node.name} (${node.kind}) · ${node.vulnerabilities.length} vulnerability(s) · ${getSeveritySummary(node)}`;
    const label = createSvgElement("text", {
      x: nodeWidth / 2,
      y: nodeHeight / 2 + 4,
      "text-anchor": "middle",
    });
    const displayName = node.name.length > 25 ? `${node.name.slice(0, 23)}…` : node.name;
    label.textContent = displayName;
    group.append(
      title,
      createSvgElement("rect", {
        width: nodeWidth,
        height: nodeHeight,
        rx: 9,
      }),
      label,
    );
    svg.append(group);
  }

  graphContainer.append(svg);
}

function renderResult(data) {
  routeCountElement.textContent = String(data.meta.routeCount);
  nodeCountElement.textContent = String(data.graph.nodes.length);
  edgeCountElement.textContent = String(data.graph.edges.length);
  renderRoutes(data.routes, data.graph.nodes);
  renderGraph(data.graph, data.routes);
  renderWarnings(data.meta.warnings);

  if (data.meta.truncated === true) {
    showError("The result was truncated by a graph traversal safety limit.");
  }
}

async function loadRoutes() {
  clearError();
  submitButton.disabled = true;
  submitButton.textContent = "Loading…";

  try {
    const query = buildQuery();
    const suffix = query.size === 0 ? "" : `?${query.toString()}`;
    const response = await fetch(`/api/routes${suffix}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Could not load routes");
    }

    renderResult(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not load routes");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Find routes";
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/health");
    const data = await response.json();

    if (!response.ok) {
      throw new Error("API unavailable");
    }

    healthElement.textContent = `API online · ${data.nodes} nodes`;
    healthElement.classList.add("health-online");
  } catch {
    healthElement.textContent = "API unavailable";
    healthElement.classList.remove("health-online");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadRoutes();
});

resetButton.addEventListener("click", () => {
  form.reset();
  void loadRoutes();
});

void Promise.all([checkHealth(), loadRoutes()]);
