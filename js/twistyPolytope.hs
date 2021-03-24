import Data.List
import qualified Data.Map.Strict as Map
import Data.Map.Strict (Map)
import Data.Default

newtype Symbol = Symbol String deriving (Eq, Ord)
instance Default Symbol where
    def  =  Symbol "A"
instance Enum Symbol where
    succ (Symbol s)  =  Symbol (s ++ "'")
instance Show Symbol where
    show (Symbol s)  =  s

rename :: (Eq a, Enum a) => [a] -> a -> a
rename list  =  fromJust . find (`notElem` list) . enumFrom
push :: (Eq a, Enum a) => a -> [a] -> [a]
push e list  =  (fromJust $ find (`notElem` list) $ enumFrom e) : list



-- Multiply Connected Abstract Polytope
data (Eq symbol, Ord symbol, Enum symbol)  =>
     Polytope symbol  =  Empty
                      |  Overlay (Polytope symbol) (Polytope symbol)
                      |  Vertex symbol (Polytope symbol) (Map symbol symbol)
                      deriving (Eq, Ord, Show)

-- empty :: Polytope symbol
-- empty  =  Empty
-- infixl 6 +
-- (+) :: Polytope symbol -> Polytope symbol -> Polytope symbol
-- Empty + p  =  p
-- p + Empty  =  p
-- p1 + p2  =  Overlay p1 p2
-- infixr 8 ^
-- (^) :: symbol -> Polytope symbol -> Polytope symbol
-- s ^ v  =  Vertex s v (Map.fromList $ map (\f -> (f, f)) $ facesOf v)
-- infixl 7 /
-- (/) :: Polytope symbol -> [(symbol, symbol)] -> Polytope symbol
-- (Vertex s v m) / eq  =  Vertex s v (map (\f -> maybe f id $ lookup f eq) m)

facesOf :: Polytope symbol -> [symbol]
facesOf Empty  =  []
facesOf (Overlay poly1 poly2)  =  facesOf poly1 `union` facesOf poly2
facesOf (Vertex face _ hom)  =  [face] `union` Map.elems hom

verticesOf :: Polytope symbol -> [symbol]
verticesOf Empty = []
verticesOf (Overlay poly1 poly2) = verticesOf poly1 ++ verticesOf poly2
verticesOf (Vertex face _ _) = [face]

flagsOf :: symbol -> Polytope symbol -> [[Polytope symbol]]
flagsOf face Empty  =  []
flagsOf face (Overlay poly1 poly2)  =  flagsOf face poly1 ++ flagsOf face poly2
flagsOf face vertex@(Vertex face' fig hom)
    | face' == face  =  [vertex:[]]
    | otherwise      =  [vertex:flag | subface' <- Map.keys $ Map.filter (== face) hom, flag <- flagsOf subface' fig]

-- inefficient implementation, just as a conceptual definition
isValid :: Polytope symbol -> Bool
isValid poly  =  all (\homs -> null homs || null (tail homs)) $ map (nub . map reduce) all_flags
    where all_flags = map (\face -> flagsOf face poly) $ facesOf poly
          reduce vertex:subflags
              | subflags == []  =  (1, vertex)
              | otherwise       =  (n+1, Vertex face fig hom'')
              where (n, Vertex face fig hom) = reduce subflags
                    Vertex _ _ hom' = vertex
                    hom'' = Map.map (hom' !) hom

replaceFaces :: [(symbol, symbol)] -> Polytope symbol -> Polytope symbol
replaceFaces eq Empty  =  []
replaceFaces eq (Overlay poly1 poly2)  =  Overlay (replaceFaces eq poly1) (replaceFaces eq poly2)
replaceFaces eq (Vertex face fig hom)  =  Vertex (rep face) fig (Map.map rep hom)
    where rep face = maybe face id $ lookup face eq

unionPolytopes :: [Polytope symbol] -> (Polytope symbol, [Map symbol symbol])
unionPolytopes polys  =  (poly', maps)
    where rename poly (maps, reserved) = (maps', reserved')
              where faces = facesOf poly
                    reserved' = foldr push reserved faces
                    maps' = Map.fromList faces reserved' : maps
          (maps, _) = foldr rename ([], []) polys
          poly' = foldl Overlay Empty $ zipWith replaceFaces maps polys

mergeVertices :: [symbol] -> Polytope symbol -> Polytope symbol
mergeVertices faces poly
    | null faces            =  poly
    | length (nub xs) == 1  =  rep poly
    where vertices = [vertex | face <- faces, let [[vertex]] = flagsOf face poly]
          face':_ = faces
          (fig', maps) = unionPolytopes [fig | Vertex _ fig _ <- vertices]
          hom' = Map.unions $ zipWith (\map -> \Vertex _ _ hom -> Map.mapKeys (map !) hom) maps vertices
          vertex' = Vertex face' fig' hom'
          
          rep (Overlay poly1 poly2)  =  Overlay (rep poly1) (rep poly2)
          rep (Vertex face _ _) | face == face'      =  vertex'
                                | face `elem` faces  =  Empty
          rep poly  =  poly
          
mergeFaces :: [symbol] -> Polytope symbol -> Polytope symbol

merge :: (symbol, symbol) -> [[Polytope symbol]] -> Polytope symbol -> Polytope symbol
merge (face1, face2) [] poly  =  case (face1 `elem` faces1, face2 `elem` faces1) of
    ( True,  True)  ->  mergeVertices [face1, face2] poly
    (False, False)  ->  mergeFaces [face1, face2] poly
    where faces1 = verticesOf poly













type Face = Int
type Chi = Bool
type Cover = (Face, Face, Chi)
type Diamond = (Cover, Cover, Cover, Cover)
type Flag = [(Face, Chi)]
data AbstractPolytope  =  AbstractPolytope { faces::[Face], covers::[Cover], diamonds::[Diamond] }

is_diamond ((f1,f2,x12), (f2',f4,x24), (f1',f3,x13), (f3',f4',x34))  =
    f1 == f1' && f2 == f2' && f3 == f3' && f4 == f4' && x12 == x24 && x13 /= x34
sup (f,_,_)  =  f
sub (_,f,_)  =  f
chi (_,_,x)  =  x
up    ((f,_,_),_,_,_)  =  f
down  (_,(_,f,_),_,_)  =  f
left  ((_,f,_),_,_,_)  =  f
right (_,_,(_,f,_),_)  =  f
lu (c,_,_,_)  =  c
ld (_,c,_,_)  =  c
ru (_,_,c,_)  =  c
rd (_,_,_,c)  =  c

compare :: AbstractPolytope -> Face -> Face -> Maybe Ordering
compare polytope face1 face2
    | face1 == face2  =  Just EQ
    | ge face1 face2  =  Just GT
    | ge face2 face1  =  Just LT
    | otherwise       =  Nothing
    where ge f1 f2  =  f1 == f2 || any (\(f1',f2',_) -> f1'==f1 && ge f2' f2) (covers polytope)

exchange :: AbstractPolytope -> Int -> Flag -> Flag
exchange polytope 1 (f0,x0):(f1,x1):(f2,x2):subflag  =  (f0,x0):(f1',x1'):(f2,x2'):subflag
    where diamonds' = (diamonds polytope) ++ map (\(c12,c24,c13,c34) -> (c13,c34,c12,c24)) (diamonds polytope)
          -- [(_,_,(_,f1',x1'),(_,_,x2'))] = filter (\(c12,c24,_,_) -> c12==(f0,f1,x1) && c24==(f1,f2,x2)) diamonds'
          Just (_,_,(_,f1',x1'),(_,_,x2')) = find (\(c12,c24,_,_) -> c12==(f0,f1,x1) && c24==(f1,f2,x2)) diamonds'
exchange polytope i c:subflag  =  assert i > 1 $ c:(exchange polytope (i-1) subflag)

(+) :: AbstractPolytope -> AbstractPolytope -> AbstractPolytope
(-) :: AbstractPolytope -> AbstractPolytope -> AbstractPolytope
swap :: [Diamond] -> AbstractPolytope -> AbstractPolytope
merge :: [Face] -> Face -> AbstractPolytope -> AbstractPolytope
split :: Face -> [Face] -> AbstractPolytope -> AbstractPolytope
connect :: Face -> Face -> AbstractPolytope -> AbstractPolytope
disconnect :: Face -> Face -> AbstractPolytope -> AbstractPolytope

replaceFace :: [(Face,Face)] -> Face -> Face
replaceFace maps face  =  maybe face id $ lookup face maps
replaceCover :: [(Face,Face)] -> Cover -> Cover
replaceCover maps (f1,f2,x)  =  (f1',f2',x)
    where f1' = replaceFace maps f1
          f2' = replaceFace maps f2
replaceDiamond :: [(Face,Face)] -> Diamond -> Diamond
replaceDiamond maps (c12,c24,c13,c34)  =  (c12',c24',c13',c34')
    where c12' = replaceCover maps c12
          c24' = replaceCover maps c24
          c13' = replaceCover maps c13
          c34' = replaceCover maps c34

merge old_faces new_face polytope  =
    let maps = zip old_faces $ repeat new_face
        
        old_subcovers = [filter ((==face) . sup) (covers polytope) | face <- old_faces]
        new_subcovers = [map (replaceCover maps) old_covers | old_covers <- old_subcovers]
        check1 = (length $ fold union new_subcovers) == (fold (+) $ length new_subcovers)
        
        old_supdiamonds = [filter ((==face) . down) (diamonds polytope) | face <- old_faces]
        new_supdiamonds = [map (replaceDiamond maps) old_diamonds | old_diamonds <- old_supdiamonds]
        check2 = (length $ nub $ map sort new_supdiamonds) <= 1
        
        faces' = nub $ map (replaceFace maps) (faces polytope)
        covers' = nub $ map (replaceCover maps) (covers polytope)
        diamonds' = nub $ map (replaceDiamond maps) (diamonds polytope)
        
    in  assert (check1 && check2) $ AbstractPolytope{faces=faces', covers=covers', diamonds=diamonds'}

split old_face new_faces polytope  =
    let 
    in  ..





swap_diamonds :: [Diamond] -> [Diamond]
swap_diamonds a:[]  =  a
swap_diamonds a:b:c  =  a':(swap_diamonds b':c)
    where (a12, a24, a13, a34) = a
          (b12, b24, b13, b34) = b
          a' = (a12, a24, b13, b34)
          b' = (b12, b24, a13, a34)

insert :: AbstractPolytope -> (Face, Face, [Diamond], [Diamond], [Diamond], [Diamond], [Diamond]) -> AbstractPolytope
insert polytope (parent, face, right, left, down, up, middle)  =
    let faces' = face |: (faces polytope)
        
        -- make covers and diamonds
        cover1 = (parent, face, True)
        cover2 = (parent, face, False)
        new_covers = [cover1, cover2]
        supcovers1 = filter (\(f,f',o) -> f' == parent && o == True) (covers polytope)
        supcovers2 = filter (\(f,f',o) -> f' == parent && o == False) (covers polytope)
        new_diamonds = map (\c0 -> (c0, cover1, c0, cover2)) $ supcovers1
                    ++ map (\c0 -> (c0, cover2, c0, cover1)) $ supcovers2
        
        -- modify sub-diamonds
        cut_diamond mode c@(_,(_,subface,_),_,_)
            | mode == '>'  =  swap [c, d]
            | mode == '<'  =  swap [c, d']
            | mode == '^'  =  swap [c, d', d]
            | mode == 'v'  =  swap [c, d, d']
            | mode == 'o'  =  swap [d, d']
            where subcover1 = (face, subface, True)
                  subcover2 = (face, subface, False)
                  d  = (cover1, subcover1, cover2, subcover1)
                  d' = (cover2, subcover2, cover1, subcover2)
        
        right'  = right  >>= (cut_diamond '>')
        left'   = left   >>= (cut_diamond '<')
        down'   = down   >>= (cut_diamond '^')
        up'     = up     >>= (cut_diamond 'v')
        middle' = middle >>= (cut_diamond 'o')
        
        old_subdiamonds = right ++ left ++ down ++ up ++ middle
        new_subdiamonds = right'++ left'++ down'++ up'++ middle'
        diamonds' = (diamonds polytope) \\ old_subdiamonds `union` new_subdiamonds `union` new_diamonds
        
        -- modify sub-covers
        new_subcovers = filter (\(f,_,_) -> f==face) $ new_subdiamonds >>= (\(_,c1,_,c2) -> [c1,c2])
        covers' = (covers polytope) `union` new_subcovers `union` new_covers
        
    in  AbstractPolytope {faces=faces', covers=covers', diamonds=diamonds'}

is_deletable :: AbstractPolytope -> Face -> Bool
is_deletable polytope face  =  ..

delete :: AbstractPolytope -> Face -> AbstractPolytope
delete polytope face  =
    let faces' = delete face (faces polytope)
        old_supcovers = filter (\(f1,f2,x) -> f2==face) (covers polytope)
        old_covers    = filter (\(f1,f2,x) -> f1==face) (covers polytope)
        covers' = (covers polytope) \\ old_supcover \\ old_covers
        [cover1@(parent, _, False), cover2@(parent', _, True)] = sort old_supcover
        check = parent == parent'
        ..
    in  assert check $
        AbstractPolytope {faces=faces', covers=covers', diamonds=diamonds'}

-- slice algorithm:
-- (bottom up: vertices => segments => element)
-- find relation and meets between knife and surface of given facet:
--   relation: inside, outside, both sides, covered
--   meets: intersections between knife and surface, separated by prefer and
--          classified by side
-- 
-- if facet is covered:
--   all descendants are also covered
--   the side of this facet cannot be determined; remain to next level
-- else if has no meet:
--   its relation is either inside or outside
--   all descendants also have no meet and have the same relation
-- else:
--   for every covered children of facet:
--     calculate distance between oriented surface of child and all oriented meets
--     (include point and sign)
--     the closest meet equals to surface of this child (always exist)
--     assign the side of descendants of this child
--   for every others maximal descendant meets and covers with depth >= 2:
--     calculate distance between maximal descendant meet and all meets
--     the closest meet covers this child (always exist)
--     determine type of meet with diamond relation (cross, touch, scoop)
--     filter out touch meet
--     assign child between maximal descendant meet and directed meet
--     and modify diamond relation between maximal descendant meet and facet
--   for all pairs of meets that meets/covers no descendant:
--     choose a point on this meet
--     if this point is inside the facet:
--       add pair of directed meets as children of facet
--       also add trivial diamond relation of this pairs of meets
-- 
-- filter out trivial facets
-- separate unconnected facets



class Sliceable surface where
    space :: surface
    pointsOn :: surface -> [surface]
    dim :: surface -> Int
    distance :: surface -> surface -> Double
    flip :: surface -> surface
    slice :: surface -> surface -> [(surface, Ordering)]

    -- (pointsOn s) `isInfixOf` (pointsOn space)
    -- all (== 0) $ map dim $ pointsOn s
    -- dim s <= dim space && dim s >= 0
    -- (dim s == 0) <= (pointsOn s == [s])
    -- (dim s == dim space) <= (s == space)
    --
    -- distance s1 s2 == distance s2 s1
    -- (distance s1 s2 == 0) == (s1 == s2)
    -- distance . flip /= distance
    --
    -- flip . flip == id
    -- pointsOn . flip == pointsOn
    -- dim . flip == dim
    -- (dim s == 0) <= (is_degenerated s)
    --
    -- ((s1 `intersect` s2) >>= (pointsOn . fst)) == (pointsOn s1) `intersect` (pointsOn s2)


-- spherical surface
Q = pi/2
data UnitQuaternion = UnitQuaternion (Double, Double, Double, Double) deriving (Eq, Ord, Show, Read)
instance Data.Group UnitQuaternion where
    mempty = UnitQuaternion (0, 0, 0, 1)
    invert UnitQuaternion (x,y,z,w) = UnitQuaternion (-x,-y,-z,w)
    UnitQuaternion (x1,y1,z1,w1) <> UnitQuaternion (x2,y2,z2,w2) = UnitQuaternion (x3,y3,z3,w3)
        where x3 = w1*x2 + x1*w2 + y1*z2 - z1*y2
              y3 = w1*y2 + y1*w2 + z1*x2 - x1*z2
              z3 = w1*z2 + z1*w2 + x1*y2 - y1*x2
              w3 = w1*w2 - x1*x2 - y1*y2 - z1*z2

data SphOrbit = SphVector (Double, Double, Double)
              | SphCircle { center::(Double, Double, Double), radius::Double }
              | SphSpace | SphEmpty
              deriving (Eq, Ord, Show, Read)
instance Orbital SphOrbit UnitQuaternion where
    space = SphSpace

    dim (SphVector _) = 0
    dim (SphCircle _ _) = 1
    dim SphEmpty = -1
    dim SphSpace = 2

    flip SphCircle (x,y,z) r = SphCircle (-x,-y,-z) 2-r
    flip o = o

    rotate q (SphVector (x,y,z)) = SphVector (x',y',z')
        where (x',y',z',_) = q * (UnitQuaternion (x,y,z,0)) * (invert q)
    rotate q (SphCircle (x,y,z) r) = SphCircle (x',y',z') r
        where (x',y',z',_) = q * (UnitQuaternion (x,y,z,0)) * (invert q)
    rotate _ o = o

    distance (SphVector (x1,y1,z1)) (SphVector (x2,y2,z2)) = (acos c)/Q
        where c = x1*x2 + y1*y2 + z1*z2
    distance v1@(SphVector _) (SphCircle c2 r2) = abs (d - r2)
        where d = distance v1 (SphVector c2)
    distance c@(SphCircle _ _) v@(SphVector _) = distance v c
    distance _ SphSpace = 0
    distance SphSpace (SphVector _) = 2
    distance SphSpace (SphCircle _ r) = max r (2-r)

    ..

