# Pure Spherical Twisty Puzzle
twisty puzzle is puzzle that can be twisted.  it is composed by finite number of pieces, and can be scrambled by rotating part of elements.  the aim of this puzzle is to recover the original state after scrambling.  this kind of puzzle must have great symmetry unless twisting operation won't work.  for example, the Rubik's cube, which has cubical symmetry, can be scrambled just by six operations: U(p\), D(own), F(ront), B(ack), L(eft) and R(ight).  because of group symmetry, the Rubik's cube doesn't transform to other shape or structure after scrambling.  but the most interesting thing is, such good symmetry like polyhedral group isn't necessary for twisty puzzles.  under less symmetry cases twisting operations may change the structure of puzzle, which is called **jumbling**.  because of nondeterministic of twisting rule, it is hard to analyze rule of twisting; we should analyze the rule after each operation.

before analyzing twisting operation, let's talk about some specific twisty puzzles, which may give you some idea.  "ghost cube" is isomorphic to Rubik's cube although it change shape every twist; "crystal dreidel" has visible deep cutting structure; "helicopter cube" jumbles when twisting about 71 degree; "bandaged cube" glue adjacent elements, which lock some operations.
and there are others kinds of operation or rule by example; all of them won't be discussed.  it is fun to break the stereotype of twisty puzzles, which is just what puzzle designers do in recent decades.  "carry-a-cube" connect two non-adjacent elements by pipes; instead of fixing position, "gear cube" drives opposite side by opposite direction when twisting; "Mayan cube" locks some operations by collision; "illegal cube" makes weird twist with fudged elements; "bubbloid" can be twisted with different origin-core.

to analyze the rule of jumbling, we focus on single-origin-core twisting operation.  under this kind of operation, any point on elements has same distance to origin before and after twisting, that means elements only collide with the elements on the same layer of shell when twisting.  then we can focus on twisty puzzle with shape of spherical shell, which has no extended part to block twisting operation.  finally, we assume there is no gap between each elements, then we can easily determine which twisting operation is possible; if there exists a full circle of boundaries, then it may be possible to twist along this track.
such kind of twisty puzzles are more like gapless sliding puzzles; the twisting operation is not determined by axis by definition, although mechanically it is built by pivot mechanism for the most part.  in fact, this rule can apply to different space, such as plane, 3D space, or even non-euclidean space.  so we give such kind of puzzle a general name: **gapless sliding puzzle**.


## Simple Gapless Sliding Puzzle
simple gapless sliding puzzle is combinational puzzle composed by connected elements, where all elements tile all space of puzzle, and possible operations are rigidly moving elements without colliding.  such rule can be applied to any kind of metric space.

denote occupied region of each element of puzzle as $E_i$, which is an open region with finite boundary $\partial E_i$: the boundary can fully describe the occupied region.  all elements should be disjointly fill up all space, which means $\forall i \neq j, E_i \cap E_j = \emptyset$ and $\operatorname{Cl}(\bigcup_i E_i) = X$.
all of valid constructions of this puzzle form configuration space of puzzle, which can be specified by rotations of elements: $\{ (E_i, Q_i) \}_{i \in I}$ with occupied regions $\{ E_i' \equiv Q_i(E_i) \}_{i \in I}$, where $Q_i$ is isometry of metric space the puzzle belongs to; not all rotations of elements are valid configurations, they should be disjointly fill up all space.  a valid operation is just the route of configuration space along continuous rotations, which can be parameterized by variable time $t$.  notice that not all configurations are reachable.
the topology of configuration space is always not a manifold.  but without unconnected bandaging, the most of parts have flat geometry.  so we only focus on some important configurations, then the configuration space can be simplified as a graph, which should be able to characterize all homotopic path of configuration space.

### symmetry of configuration space
for any configuration $\{ (E_i, Q_i) \}_{i \in I}$, there exists a certain route called global rotation: $\{ (E_i, Q o Q_i) \}_{i \in I}$.

- unit elements
- unit operations

### abstract polytope representation
ignoring absolute orientation, the configuration of puzzle also can be described by contacts between elements, which represent the relative positions of elements.
two elements are adjacent iff they have non-empty contact $C_{ij} \equiv \partial E_i \cap \partial E_j$, where we only consider $(N-1)$-dimensional contacts.  such contacts should cover all boundaries, and intersection of three boundaries has no $(N-1)$-dimensional contact; lakes of Wada isn't in our consideration.  moreover, two contacts may meet at some points, such as $C_{ijk} = C_{ij} \cap C_{jk} \cap C_{ki}$, where $C_{ijk}$ is minmum $(N-2)$-dimensional contact; minmum means it doesn't contain other $(N-2)$-dimensional contact which has more indices.
then consider intersections of contacts of contacts, and so on.  all contacts form an abstract polytope.  and especially, empty set and whole space are also objects of this polytope: $\operatorname{dim}(\emptyset) = -1$, $\operatorname{dim}(X) = N$.  such polytope define the partial order relations, which characterize the composition of different dimensional objects.  for example, vertices of face are always lesser than face: $V_i, V_j, V_k < F_{i,j,k}$.  the $(n-1)$-dimensional objects can describe the relative position between $n$-dimensional objects, and also can determine twist rule of this configuration.

### rigid lock lemma
movement of elements won't change shapes and volumes of elements, or we say all elements are rigid, so gapless sliding only work for some kind of boundaries.  in general, a valid operation can move a lot of elements simultaneously, although we always twist puzzle one by one.  the question is if any valid operation is possible to and how to be decomposed as series of simple twists.

the configuration of puzzle can be described by contacts, so one can define general twist as an operation on contacts.  during a valid operation, the position and volume of contact changes, but every inch of boundaries should be contacted to anthor element, otherwise this puzzle becomes non-gapless.
by continuity, the point $x$ on a contact $C_{ij}$ of elements $i, j$ won't go to far after a small operation: we can find it around the given distance $\delta$ at next moment (under some infinitesimal delay $\epsilon$).  focus on the point in interior of contact $C_{ij}$ (not in others lower-dimensional contacts), then those two elements cannot untouch at next moment (under any infinitesimal delay $\epsilon$) because there is no other element around it (in a range of distance $\delta$).  that means adjacent elements only can be moved by sliding along the contact, which restricts the possible movements of this configuration.  the slidable boundary can be drawn by orbit of subgroup of rotations, which must have lesser dimension than full group of rotations.  the local curvature and norm of slidable boundary determine whole curvature and norm of slidable part.

and for the point at the boundary of contact, the possible movements between them are constrained by adjacent contacts.  the sliding operation along this boundary, if exists, is always valid, because it won't change region of adjacent contacts around this point.  for the operation that change the region of contact, at next moment (under given infinitesimal delay $\epsilon$) there exists a boundary of element that change the adjacency around this point (in some radius $\delta$), which can only be retouched by the boundary of element with the same curvature and norm.  if there only exist another boundary which has same curvature but has different norm, it is also impossible to retouch it because of divergence of rotational speed of norm.  that extends the slidable interface to whole orbit of subgroup, which is called track.
by this theorem, intersected tracks cannot be twisted simultaneously, so any general twist is just composition of simple twists, which only twist along one track.  but those simple twists may not commute if there exists unconnected element, which gives more constraint on the twist rule.  so below we will focus on twisty puzzles without unconnected elements, called simple gapless sliding puzzles.

in practice, twisty puzzles always work with pivot mechanism, which will fix the axis of twisting operation.  but in our definition, it is easy to make puzzle that have some axis which will move after twisting some regions.  moreover, there exists unexpected twisting axis (fairy ring), which is more like sliding operation, so we call it sliding puzzle, not twisty puzzle.

### unit element
unit partition is collection of maximal sets of elements they won't change relative orientations, so they can be bandaged into unit elements, which won't change the twisting rule.  finding unit elements without knowledge of whole twisting rule is a way to simplify the calculation of analyzation.

a set of elements is said to be _unseparatable_ if there doesn't exist a circle that fully separate them into two sets.  for example, two adjacent elements are unseparable if they have rugged boundary bwtween them; teeth shape elements aren't adjacent but still not separable; three-part cake is unseparable even if each pair is separable.
an element is said to be separable if there is no unseparable set conains it, so only the element with arc boundaries may be separable.  by **rigid lock lemma**, unseparatable set of elements must be in the same set of unit.  in fact, the collection of maximal unseparatable sets is almost (not directly) equal to unit partition, but such test is hard to implement.
the unit element may be unconnected (Merry-Go-Round), even though it is not unseparable, which is caused by mechanical structure.  moreover, four corners of "skewb" have fixed position and free orientation, which is also caused by mechanical structure; to obtain such constraint need all information of twisting rule, which is another story though.

we say a boundary of element is _twistable_ means, this element doesn't stop, or touch outside the extended circle of such boundary.  if an element has untwistable boundaries, then it and its adjacent element are unseparatable.  that means the boundaries of unit element must be constructed by arc boundaries with convex angle between arcs, and moreover, be defined by disjoint union of intersection of circles.
not all elements enclosed by arc boundaries with convex angles can be described by intersection of spherical circles.  for example, spiked shape can be decomposed as disjoint union of two shapes, which are intersection of spherical circles.  not all elements built by intersection of circles are connected.  for example, white eye shape is built by three circles but not connected.  inversely, connected elements can be built by intersection of circles, but may not easy to do: just punch out unwanted region by removing circles (greedy worm).  those exceptions tell use it is not easy to deal with boundary representation, but it is still an efficient and controllable approach.

a special case of untwistable edge is tip shape boundary, which is two vertices (belong to the same element) against together.  any track crossing over the tip is untwistable.  almost all tips have untwistable edges (except for sandglass-shape tip), so them will disappear after merging all untwistable edges.  sandglass-shape tip has shape of two kissing circles, so the edges of the tip are twistable, otherwise there exists an edge of the tip whose extended circle will be stopped by or cross over the tip.

- locally twistable

### unit operation
by **rigid lock lemma**, a general twist can be piecewisely described by disjoint sliding circles and its twisting angles as function of time.  without unconnected bandaging general twist can be further decomposed as series of simple twists, which only twists one sliding circle.
if there exists a set of contacts forming a full circle, then it can be twisted along this circle, called track.  there exists inner and outer range beside the track that won't be separated unless break this track, called shields.  then we can distinguish track by their shields, so twist operation can be performed by tracks without specifying the position of twisted regions.  twisting a track with random angle will make this track unbreakable: the shields become unseparable unless twist this track.  then we say this track is locked, and unlockable track means its shields can be separated finally.  if a track isn't unlockable, the shields become unseparable, which means they can be fused into two elements.

because a general twist is defined by tracks, it is not always valid under every configurations.  but some configurations may possess same tracks, so general twists built by those tracks are applicable under those configurations.  the commutation relations of general twists are determined by intersection relation between those tracks: general twists with non-intersected tracks commute, in fact each operation isn't applicable after applying another operation if their tracks intersect, you only can choose one direction to twist.

non-trivial operations are operations that can't be decomposed as simple twist.  if all elements are connected, any operation can be decomposed as simple twist.  with unconnected bandaging, apple core shape puzzle has complex twisting operation (twisting upper and lower co-axis circle simultaneously) that cannot be decomposed.  moreover, using gimbal lock there may exist non-co-axis non-trivial complex twisting operation; that is why we want to focus on simple (no unconnected element) gapless sliding puzzles.

without unconnected bandaging, by reordering operations according to such commutation relations, one can normalize a valid operation as series of simple twists, such that one track twists at most one time in its lifespan.  in some normalized valid operations, if there is a simple twist whose track has finite lifespan (not starts from initial configuration and also not ends with final configuration), then such operation is called unit operation.
notice that such normalization is not unique, one can switch the order of two adjacent tracks if they are disjoint.  those tracks have structure of partial order relations, the missing relations to form total order correspond to all possible normalizations.  now focus on a specific track of those equivalent normalization...
according to this criteria, one can define unit confinguration of puzzles...

for unconnected bandaging cases, it's hard to define unit operations...

- kissing boundaries
- unpredictable axis - fairy ring

### network structure
hole of non-simply connected element is related to connected web, which is composed by connected boundaries; non-simply connected element is bridge bewteen unconnected web, and connected web link each unconnected part of element.  unconnected boundaries won't interact with each others, so non-simply connected elements can be considered as combination of independent puzzles; the operations of each part is trivial to others part.


## model
with above discussion, we only need to know information about arc segments of boundaries: curvatures of segments, lengths of segments, connection of segments, angles between connected segments, adjacency of segments, relative position between adjacent segments, affiliation of segments.
elements can be determined by connections of segments, and validation of twisting operations can be determined by flat angles of connected segments, and non-triviality of twisting operations can be determined by vertices of segments.  unfortunately, we still need to know exect relative positions (or absolute positions) between each segment when bandaging and unbandaging.

pre-model: absolute position of start/end vertices of segments, absolute position of circles of segments.
with graphically requirement, we need to know inclusion relation between boundaries (boundaries of non-simply connected elements).

### representation
there are three possible useful model
- march grid representation
  element is represented by sets of sample points.
  it is easy to evolve state under given twisting operation, but impossible to find possible twisting operation in general.
- disjoint normal representation
  element is represented by disjoint union of intersection of circles.
  an element that can be described by intersection of circles is called normal element, and all non-trivial elements can be considered as bandaging of disjoint normal element, called disjoint normal representation.
  all shapes can be built by intersection of circles (greedy worm).
  it is easy to rebuild from set representation to boundary representation and march grid representation, but the reverse is hard.
  it is hard to find simple operation to unbandage unconnected part of element under set representation.
- boundary representation
  element is represented by oriented boundaries of shape, which is composed by arc of circle (rigid lock lemma): the region counterclockwisely enclosed by set of arcs define an element.  to simplify calculation, we require that boundaries don't intersect each others, and don't form widthless hair.  but it is valid to have widthless gaps and sandglass-shape tips.
  it is playable: it is able to find possible twisting operation and non-trivial twisting angle (walk algorithm), and is able to evolve state by operation.
  it is hard to use boundary representation of element built by intersection of circles to rebuild set representation, because for some cases (one side of white eye shape) there are some circles which has no boundary (unrepresented circles).
  to slice element under boundary representation, we need to deal with some special cases (no intersection between boundaries), which may be rare but hard to solve.
  this representation only need 0D calculation (no conditions of continuous-variable to determine) when playing.
