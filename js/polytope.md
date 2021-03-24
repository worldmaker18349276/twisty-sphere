## Lower Bounded Poset
### lower bounded poset
- $(\mathcal{F}, <)$ is lower bounded poset iff it has
  - transitivity: $F_1 < F_2 \land F_2 < F_3 \implies F_1 < F_3$
  - irreflexivity: $F \not< F$
  - asymmetry: $F < E \implies E \not< F$
  - bottom: $\emptyset \le F$

- upper closure: $\uparrow F \equiv \{ E \in \mathcal{F} | E \ge F \}$
  strict upper closure: $\dot\uparrow F \equiv \{ E \in \mathcal{F} | E > F \}$

- $E = F \Leftrightarrow \uparrow E = \uparrow F$
  $E < F \Leftrightarrow \uparrow E \subset \uparrow F$
- $\uparrow F = \bigcup_{E \gtrdot F} \uparrow E \cup \{F\}$


### strict up preserving map
- definition: $\phi : \mathcal{F}' \overset{\text{up!}}{\longrightarrow} \mathcal{F} \Leftrightarrow \phi(\dot\uparrow F') = \dot\uparrow \phi(F')$

- $\phi(\uparrow F') = \uparrow \phi(F')$
  > $\phi(\uparrow F') = \phi(\dot\uparrow F' \cup \{F'\}) = \phi(\dot\uparrow F') \cup \{\phi(F')\}$
  > $= \dot\uparrow \phi(F') \cup \{\phi(F')\} = \uparrow \phi(F')$

- $E' > F' \implies \phi(E') > \phi(F')$
  > $E' > F'$
  > $\Rightarrow \phi(E') \in \phi(\dot\uparrow F') = \dot\uparrow \phi(F')$
  > $\Rightarrow \phi(E') > \phi(F')$

- $\forall E > \phi(F'), \exists E' > F' \text{ s.t. } \phi(E') = E$
  > $E > \phi(F')$
  > $\Rightarrow E \in \dot\uparrow \phi(F') = \phi(\dot\uparrow F') = \{ \phi(E') | E' > F' \}$
  > $\Rightarrow \exists E' > F' \text{ s.t. } \phi(E') = E$

- $\forall E \gtrdot \phi(F'), \exists E' \gtrdot F' \text{ s.t. } \phi(E') = E$
  > $E \gtrdot \phi(F')$
  > $\Rightarrow \exists E' > F' \text{ s.t. } \phi(E') = E$
  > assume $E' \not\gtrdot F'$
  > $\Rightarrow \exists G' \text{ s.t. } E' > G' > F'$
  > $\Rightarrow \phi(E') > \phi(G') > \phi(F') \Rightarrow \phi(E') \not\gtrdot \phi(F')$
  > $\Rightarrow\!\Leftarrow$

- $E' \gtrdot F' \implies \phi(E') \gtrdot \phi(F')$
  > $E' \gtrdot F'$
  > $\Rightarrow \phi(E') > \phi(F')$
  > assume $\phi(E') \not\gtrdot \phi(F')$
  > $\Rightarrow \exists G \text{ s.t. } \phi(E') > G > \phi(F')$
  > $\Rightarrow \exists G' > F' \text{ s.t. } \phi(G') = G$
  > $\Rightarrow \phi(E') = E > \phi(G')$
  > $\Rightarrow \exists \tilde{E}' > G' \text{ s.t. } \phi(\tilde{E}') = E$
  > $\Rightarrow \tilde{E}' > E' \Rightarrow \phi(\tilde{E}') > \phi(E')$
  > $\Rightarrow\!\Leftarrow$


### decomposition
- quotient poset $\mathcal{F}' / [F_1' = F_2']$
  $\mathcal{F}' / [F_1' = F_2'] \equiv \mathcal{F}' \setminus \{F_1', F_2'\} \cup \{F_1' \times F_2'\}$
  > $F_1' < F' \lor F_2' < F' \Leftrightarrow F_1' \times F_2' <' F'$
  > $E' < F_1' \lor E' < F_2' \Leftrightarrow E' <' F_1' \times F_2'$
  > $F_1' \times F_2' \not<' F_1' \times F_2'$
  > $E' < F' \Leftrightarrow E' <' F'$
  > $\Rightarrow$ $\mathcal{F}' / [F_1' = F_2']$ might not be poset

  $\mathcal{F}' \text{ is poset} \land \dot\uparrow F_1' = \dot\uparrow F_2' \implies \mathcal{F}'/[F_1'=F_2'] \text{ is poset}$
  > irreflexivity:
  > $F' \neq F_1', F_2' \Rightarrow F' \not> F' \Rightarrow F' \not>' F'$
  > $F' = F_1' \times F_2' \Rightarrow F' \not>' F'$
  > asymmetry:
  >  $F' >' E'$
  > $F', E' \neq F_1' \times F_2' \Rightarrow F' > E' \Rightarrow F' \not< E' \Rightarrow F' \not<' E'$
  > $F' = F_1' \times F_2' \Rightarrow E' \neq F_1' \times F_2' \Rightarrow F_1' > E' \lor F_2' > E' \Rightarrow F_1' \not< E' \lor F_2' \not< E' \Rightarrow F' \not<' E'$
  > $E' = F_1' \times F_2' \Rightarrow \dots \Rightarrow F' \not<' E'$
  > transitivity:
  > $E' <' F' \land F' <' G'$
  > $E' = F_1' \times F_2' \Rightarrow F', G' \neq F_1' \times F_2' \Rightarrow (F_1' < F' \lor F_2' < F') \land F' < G' \Rightarrow F_1' < G' \lor F_2' < G' \Rightarrow E' <' G'$
  > $G' = F_1' \times F_2' \Rightarrow \dots \Rightarrow E' <' G'$
  > $F' = F_1' \times F_2' \Rightarrow E', G' \neq F_1' \times F_2' \Rightarrow (E' < F_1' \lor E' < F_2') \land (F_1' < G' \lor F_2' < G')$
  > $\overset{*}{\Rightarrow} (E' < F_1' \lor E' < F_2') \land (F_1' < G' \land F_2' < G') \Rightarrow E' < G' \Rightarrow E' <' G'$

- quotient map $[F_1' = F_2'] : \mathcal{F}' \longrightarrow \mathcal{F}' / [F_1' = F_2']$
  $F' [F_1' = F_2'] \equiv F'$ if $F' \neq F_1', F_2'$ otherwise $F_1' \times F_2'$

  $\mathcal{F}' \text{ is poset} \land \dot\uparrow F_1' = \dot\uparrow F_2' \implies [F_1' = F_2'] : \mathcal{F}' \overset{\text{up!}}{\longrightarrow} \mathcal{F}' / [F_1' = F_2']$
  > $\phi_0 \equiv [F_1' = F_2']$
  > $F' \neq F_1', F_2' \Rightarrow$
  > $\phi_0(\dot\uparrow F') = \phi_0(\{E' | E' \in \mathcal{F}', E' > F'\})$
  > $= \{E' | E' \in \mathcal{F}' \setminus \{F_1', F_2'\}, E' > F'\} \cup \{F_1' \times F_2' | F_1' > F' \lor  F_2' > F'\}$
  > $= \{E' | E' \in \mathcal{F}'/[F_1'=F_2'] \setminus \{F_1' \times F_2'\}, E' >' F'\} \cup \{F_1' \times F_2' | F_1' \times  F_2' >' F'\}$
  > $= \{E' | E' \in \mathcal{F}'/[F_1'=F_2'], E' >' F'\} = \dot\uparrow \phi_0(F')$
  > $F' = F_1' \text{ or } F_2' \Rightarrow$
  > $\phi_0(\dot\uparrow F') = \phi_0(\{E' | E' \in \mathcal{F}', E' > F'\})$
  > $\overset{*}{=} \{E' | E' \in \mathcal{F}' \setminus \{F_1', F_2'\}, E' > F'\}$ because $F_1' \not\lesseqgtr F_2'$
  > $= \{E' | E' \in \mathcal{F}'/[F_1'=F_2'] \setminus \{F_1' \times F_2'\}, E' >' F_1' \times F_2'\}$
  > $= \{E' | E' \in \mathcal{F}'/[F_1'=F_2'], E' >' F_1' \times F_2'\} = \dot\uparrow \phi_0(F')$

- reduced map $\phi/[F_1'=F_2']$
  $\phi(F_1') = \phi(F_2') \Rightarrow \phi/[F_1'=F_2'] : \mathcal{F}'/[F_1'=F_2'] \rightarrow \mathcal{F}$
  $\phi/[F_1'=F_2'](F') \equiv \phi(F')$ if $F' \neq F_1' \times F_2'$ otherwise $\phi(F_1')$
  $\phi = \phi/[F_1' = F_2'] \circ [F_1' = F_2']$

  $\phi : \mathcal{F}' \overset{\text{up!}}{\longrightarrow} \mathcal{F} \land \dot\uparrow F_1' = \dot\uparrow F_2' \land \phi(F_1') = \phi(F_2') \implies \phi/[F_1'=F_2'] : \mathcal{F}'/[F_1'=F_2'] \overset{\text{up!}}{\longrightarrow} \mathcal{F}$
  > $\phi' \equiv \phi/[F_1'=F_2']$
  > $F' \neq F_1' \times F_2' \Rightarrow$
  > $\phi'(\dot\uparrow F') = \phi'(\{ E' | E' \in \mathcal{F}'/[F_1'=F_2'], E' >' F' \})$
  > $= \{ \phi(E') | E' \in \mathcal{F}'/[F_1'=F_2'] \setminus \{ F_1' \times F_2' \}, E' >' F' \} \cup \{ \phi(F_1') | F_1' \times F_2' >' F' \}$
  > $= \{ \phi(E') | E' \in \mathcal{F}' \setminus \{ F_1', F_2' \}, E' > F' \} \cup \{ \phi(F_1') | F_1' > F' \lor F_2' > F' \}$
  > $= \{ \phi(E') | E' \in \mathcal{F}', E' > F' \} = \phi(\dot\uparrow F') = \dot\uparrow \phi(F') = \dot\uparrow \phi'(F')$
  > $F' = F_1' \times F_2' \Rightarrow$
  > $\phi'(\dot\uparrow F') = \phi'(\{ E' | E' \in \mathcal{F}'/[F_1'=F_2'], E' >' F_1' \times F_2' \})$
  > $= \{ \phi(E') | E' \in \mathcal{F}'/[F_1'=F_2'] \setminus \{ F_1' \times F_2' \}, E' >' F_1' \times F_2' \}$
  > $= \{ \phi(E') | E' \in \mathcal{F}' \setminus \{ F_1', F_2' \}, E' > F_1' \lor E' > F_2' \}$
  > $\overset{*}{=} \{ \phi(E') | E' \in \mathcal{F}', E' > F_1' \lor E' > F_2' \}$ because $F_1' \not\lesseqgtr F_2'$
  > $= \phi(\dot\uparrow F_1') \cup \phi(\dot\uparrow F_2') = \dot\uparrow \phi(F_1') \cup \dot\uparrow \phi(F_2') = \dot\uparrow \phi'(F')$


## Abstract Polytope
### fraction poset
- $(\mathcal{N}/\mathcal{N}, \,\cdot\,)$ is fraction poset iff
  $\mathcal{N}$ is poset
  $\mathcal{N}/\mathcal{N} \equiv \{ [a/b]_i | a, b \in \mathcal{N}, a \ge b \}$
  $a/b \equiv \{ [a/b]_i \}$
  $a/a = \{ [a/a]_0 \}$
  $(\,\cdot\,) : a/b \times b/c \longrightarrow a/c$
  $(f \cdot g) \cdot h = f \cdot (g \cdot h)$
  $a > b > c \implies \forall [a/c]_k, \exists [a/b]_i, [b/c]_j \text{ s.t. } [a/b]_i \cdot [b/c]_j = [a/c]_k$
  $[a/b]_i \cdot [b/b]_0 = [a/a]_0 \cdot [a/b]_i = [a/b]_i$

- partial order: $[a/b]_i \le [c/d]_l \Leftrightarrow \exists [c/a]_j, [b/d]_k \text{ s.t. } [c/a]_j \cdot [a/b]_i \cdot [b/d]_k = [c/d]_l$
  $\mathcal{N}/b \equiv \{ [a/b]_i | a \in \mathcal{N}, a \ge b \}$ is lower bounded poset
  $a/\mathcal{N} \equiv \{ [a/b]_i | b \in \mathcal{N}, a \ge b \}$ is lower bounded poset
  $(\,\cdot[b/c]_j) : \mathcal{N}/b \overset{\text{up!}}{\longrightarrow} \mathcal{N}/c$
  $([a/b]_i\cdot\,) : b/\mathcal{N} \overset{\text{up!}}{\longrightarrow} a/\mathcal{N}$

- normalization: $\forall a \in \mathcal{N}, 1 \le a \land a/1 = \{ [a/1]_0 \}$
  $\mathcal{N}' \equiv \mathcal{N}/1$ and $a_i' \equiv [a/1]_i$
  > $a_s' \ge b_t' \implies \exists [a/b]_i \in a/b \text{ s.t. } [a/1]_s = [a/b]_i \cdot [b/1]_t$

  $a_s'/b_t' \equiv \{ [a_s'/b_t']_i | [a/b]_i \cdot [b/1]_t = [a/1]_s \}$
  > $a_s'/1_0' = \{ [a_s'/1_0']_s \}$
  > $a_s'/a_s' = \{ [a_s'/a_s']_0 \}$

  $[a_s'/b_t']_i \cdot [b_t'/c_u']_j = [a_s'/c_u']_k \Leftrightarrow [a/b]_i \cdot [b/c]_j = [a/c]_k$
  $(\,\cdot\,) : a_s'/b_t' \times b_t'/c_u' \longrightarrow a_s'/c_u'$ (surjective)
  > $\forall [a_s'/c_u']_k \in a_s'/c_u' \Rightarrow \forall [a/c]_k \in a/c \text{ s.t. } [a/c]_k \cdot [c/1]_u = [a/1]_s$
  > $\exists [a/b]_i \in a/b, [b/c]_j \in b/c \text{ s.t. } [a/b]_i \cdot [b/c]_j = [a/c]_k$
  > $\Rightarrow [a/b]_i \cdot [b/c]_j \cdot [c/1]_u = [a/c]_k \cdot [c/1]_u = [a/1]_s$
  > $\exists [b/c]_{j'} \in b/c \text{ s.t. } [b/c]_{j'} \cdot [c/1]_u = [b/1]_t$
  > $\exists [a/b]_{i'} \in a/b \text{ s.t. } [a/b]_{i'} \cdot [b/1]_t = [a/1]_s$
  > $\Rightarrow [a/b]_{i'} \cdot [b/c]_{j'} \cdot [c/1]_u = [a/c]_k \cdot [c/1]_u$

### geometrical interpretation
- n-face is denoted as $F \in \mathcal{F}$, which represents $n$-dimensional geometry object.  $\emptyset$ doesn't match any geometry object
  $\mathcal{F}$ form a lower bounded poset, which represents the incidence structure between geometry objects
  $E \gtrdot F$ means $F$ is part of boundary of $E$, and for all n-faces $E > \emptyset$
- vertex figure $\mathcal{F}/F$ is sliced geometry objects around $F$, especially $\mathcal{F}/\emptyset = \mathcal{F}$
  face of vertex figure is denoted as $(E/F)_i \in \mathcal{F}/F$, which represents slicing $E$ around $F$, and $i$ means multiple intersections
  $\mathcal{F}/F$ form a lower bounded poset, which represents the incidence structure of vertex figure
  for each incident geometry object $E > F$, there exists at least one intersection $(E/F)_i$, especially $F/F = \emptyset$
- vertex figure embedding $\phi_E$, which maps $(D/E)_i$ to $D$, maps sliced geometry objects to its host geometry objects, especially $\phi_E(\emptyset) = E$
  $\phi_E : \mathcal{F}/E \overset{\text{up!}}{\longrightarrow} \mathcal{F}$ is strict up preserving map, that means the incidence structure of vertex figure is related to incidence structure of host geometry objects
- trict the vertex figure $\mathcal{F}/F$ as host geometry objects, the corresponding vertex figure around $(E/F)_i$ is same as the vertex figure $\mathcal{F}/E$
  the corresponding embedding map is $\phi_{(E/F)_i}$, called sub-embedding, especially $\phi_{(E/F)_i}(\emptyset) = (E/F)_i$ and $\phi_\emptyset = \operatorname{id}$
  sub-embedding $\phi_{(E/F)_i} : \mathcal{F}/E \overset{\text{up!}}{\longrightarrow} \mathcal{F}/F$ is also strict up preserving map
  vertex figure embedding map is also sub-embedding map $\phi_E = \phi_{E/\emptyset}$
  composition of sub-embedding should be closed: $\phi_{(E/F)_i} \circ \phi_{(D/E)_j} = \phi_{(D/F)_k}$
- vertex figure $\mathcal{F}/F$ also form an abstract polytope, denoted as $\mathcal{P}/F$


### definition
- $\mathcal{P} \equiv (\{ \mathcal{F}/F \}_{F \in \mathcal{F}}, \{ \phi_{(E/F)_i} \}_{F \in \mathcal{F}, (E/F)_i \in \mathcal{F}/F})$
  $\forall F \in \mathcal{F}$, $\mathcal{F}/F$ is lower bounded poset, where $\mathcal{F} = \mathcal{F}/F|_{F=\emptyset}$
  $\forall F \in \mathcal{F}, \; \phi_F \equiv \phi_{(F/\emptyset)_0} : \mathcal{F}/F \overset{\text{up!}}{\longrightarrow} \mathcal{F}$, and $\phi_F(\emptyset) = F, \phi_F((E/F)_i) = E$
  $\forall (E/F)_i \in \mathcal{F}/F, \; \phi_{(E/F)_i} : \mathcal{F}/E \overset{\text{up!}}{\longrightarrow} \mathcal{F}/F$, and $\phi_{(E/F)_i}(\emptyset) = (E/F)_i, \phi_{(E/F)_i}((D/E)_j) = (D/F)_k$
  $\phi_{(E/F)_i} \circ \phi_{(D/E)_j} = \phi_{(D/F)_k}$

- $\mathcal{P}' = \mathcal{P}/F \equiv (\{ \mathcal{F}/E \}_{(E/F)_i \in \mathcal{F}/F}, \{ \phi_{(D/E)_j} \}_{(E/F)_i \in \mathcal{F}/F, (D/E)_j \in \mathcal{F}/E})$
  $\forall F' \in \mathcal{F}', \mathcal{F}'/F'$ is lower bounded poset, where $\mathcal{F}' = \mathcal{F}'/F'|_{F'=\emptyset}$
  > $\mathcal{P}' = \mathcal{P}/F \Rightarrow \{ \mathcal{F}'/F' \}_{F' \in \mathcal{F}'} \equiv \{ \mathcal{F}/E \}_{(E/F)_i \in \mathcal{F}/F} \Rightarrow \mathcal{F}' \equiv \mathcal{F}/F, F' \equiv (E/F)_i, \mathcal{F}'/F' \equiv \mathcal{F}/E$
  > $\Rightarrow (\mathcal{F}/F)/(E/F)_i = \mathcal{F}/E$
  > $\mathcal{F}'/F' = (\mathcal{F}/F)/(E/F)_i = \mathcal{F}/E$ is lower bounded poset
  > $\mathcal{F}'/F'|_{F'=\emptyset} = \mathcal{F}/E|_{(E/F)_i=\emptyset} = \mathcal{F}/E|_{E=F} = \mathcal{F}/F = \mathcal{F}'$

  $\phi_{F'} \equiv \phi_{(F'/\emptyset)_0} : \mathcal{F}'/F' \overset{\text{up!}}{\longrightarrow} \mathcal{F}'$, and $\phi_{F'}(\emptyset) = F', \phi_{F'}((E'/F')_{i'}) = E'$
  > $\mathcal{P}' = \mathcal{P}/F \Rightarrow \{ \phi_{F'} \}_{F' \in \mathcal{F}'} \equiv \{ \phi_{(E/F)_i} \}_{(E/F)_i \in \mathcal{F}/F} \Rightarrow \mathcal{F}' \equiv \mathcal{F}/F, F' \equiv (E/F)_i$
  > $\phi_{F'} = \phi_{(E/F)_i} : \mathcal{F}/E \overset{\text{up!}}{\longrightarrow} \mathcal{F}/F = \mathcal{F}'/F' \overset{\text{up!}}{\longrightarrow} \mathcal{F}'$
  > $\forall (D/F)_k \ge (E/F)_i, \exists (D/E)_j \in \mathcal{P}/E \text{ s.t. } \phi_{(E/F)_i}((D/E)_j) = (D/F)_k$
  > $\Rightarrow ((D/F)_k/(E/F)_i)_{i'} = (D/E)_j$ ($i'$ depends on $(i,j,k)$)
  > $E = F \Rightarrow \phi_{(E/F)_i}((D/E)_j) = \phi_{\emptyset}((D/F)_j) = (D/F)_k \Rightarrow j = k$

  $\phi_{(E'/F')_{i'}} : \mathcal{F}'/E' \overset{\text{up!}}{\longrightarrow} \mathcal{F}'/F'$, and $\phi_{(E'/F')_{i'}}(\emptyset) = (E'/F')_{i'}, \phi_{(E'/F')_{i'}}((D'/E')_{j'}) = (D'/F')_{k'}$
  > $\mathcal{P}' = \mathcal{P}/F \Rightarrow \{ \phi_{(E'/F')_{i'}} \}_{F' \in \mathcal{F}', (E'/F')_{i'} \in \mathcal{F}'/F'} \equiv \{ \phi_{(D/E)_j} \}_{(E/F)_i \in \mathcal{F}/F, (D/E)_j \in \mathcal{F}/E}$
  > $\Rightarrow \mathcal{F}' \equiv \mathcal{F}/F, F' \equiv (E/F)_i, \mathcal{F}'/F' \equiv \mathcal{F}/E, (E'/F')_{i'} \equiv (D/E)_j$
  > $\Rightarrow E' = (D/F)_k = \phi_{(E/F)_i}((D/E)_j)$
  > $\phi_{(E'/F')_{i'}}= \phi_{(D/E)_j} : \mathcal{F}/D \overset{\text{up!}}{\longrightarrow} \mathcal{F}/E = \mathcal{F}'/E' \overset{\text{up!}}{\longrightarrow} \mathcal{F}'/F'$
  > $\phi_{(E'/F')_{i'}}(\emptyset) = \phi_{(D/E)_j}(\emptyset) = (D/E)_j = (E'/F')_{i'}$
  > $\forall (C/E)_l \ge (D/E)_j, \exists (C/D)_m \in \mathcal{F}/D \text{ s.t. } \phi_{(D/E)_j}((C/D)_m) = (C/E)_l$
  > $\Rightarrow D' \equiv (C/F)_n, ((C/F)_n/(D/F)_k)_{j'} = (C/D)_m, ((C/F)_n/(E/F)_i)_{k'} = (C/E)_l$

  $\phi_{(E'/F')_{i'}} \circ \phi_{(D'/E')_{j'}} = \phi_{(D'/F')_{k'}}$
  > $F' \equiv (E/F)_i, E' \equiv (D/E)_j, D' \equiv (C/D)_k$
  > recall $((D/F)_k/(E/F)_i)_{i'} = (D/E)_j$, where $i' \mapsto j, (i, j) \mapsto k$
  > $(E'/F')_{i'} = ((D/E)_j/(E/F)_i)_{i'} = (D/E)_m$, where $i' \mapsto m, (i, m) \mapsto j$
  > $(D'/E')_{j'} = ((C/D)_k/(D/E)_j)_{j'} = (C/D)_n$, where $j' \mapsto n, (j, n) \mapsto k$


