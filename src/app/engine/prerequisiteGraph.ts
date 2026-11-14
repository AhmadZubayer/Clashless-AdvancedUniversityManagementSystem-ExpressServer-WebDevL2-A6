export function hasPrerequisiteCycle(
	edges: readonly { courseId: string; prerequisiteId: string }[],
) {
	const graph = new Map<string, string[]>();
	for (const edge of edges)
		graph.set(edge.courseId, [
			...(graph.get(edge.courseId) ?? []),
			edge.prerequisiteId,
		]);
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (id: string): boolean => {
		if (visiting.has(id)) return true;
		if (visited.has(id)) return false;
		visiting.add(id);
		for (const prerequisite of graph.get(id) ?? [])
			if (visit(prerequisite)) return true;
		visiting.delete(id);
		visited.add(id);
		return false;
	};
	return [...graph.keys()].some(visit);
}
