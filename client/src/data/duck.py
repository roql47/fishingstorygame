from itertools import permutations

# 주어진 알파벳 조각들
chunks = ["MU", "DI", "TA", "NT", "OV", "DU", "CK", "ER", "SC"]

# D로 시작하는 조각만 시작점으로 사용
starting_chunks = [chunk for chunk in chunks if chunk.startswith("D")]

# 결과 저장할 세트
valid_words = set()

# 2~5개 조각을 조합해서 8글자인 경우 찾기
for i in range(2, 6):
    for p in permutations(chunks, i):
        combined = ''.join(p)
        if len(combined) == 8 and combined.startswith("D"):
            valid_words.add(combined.upper())

# 결과 출력
for word in sorted(valid_words):
    print(word)
