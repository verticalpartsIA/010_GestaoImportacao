"""
Converte PNGs para SVG vetorial usando quantização de cores + contornos.
Requer: Pillow, NumPy
"""
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Diretório de trabalho
WORKDIR = Path(r"C:\Users\gelso\OneDrive\Área de Trabalho\SitesProjetos\010_GestaoImportacao\não commitar\Imagens da tela")

def trace_contours(mask):
    """
    Retorna uma lista de caminhos (lista de (x,y)) para os contornos
    de uma máscara binária usando algoritmo simplificado de contorno.
    """
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    contours = []
    
    # Direções: N, E, S, W
    directions = [(-1,0), (0,1), (1,0), (0,-1)]
    
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not visited[y, x]:
                # BFS para encontrar componente conexo
                stack = [(x, y)]
                visited[y, x] = True
                component = []
                while stack:
                    cx, cy = stack.pop()
                    component.append((cx, cy))
                    for dx, dy in directions:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not visited[ny, nx]:
                            visited[ny, nx] = True
                            stack.append((nx, ny))
                
                if len(component) < 4:  # Ignora pixels isolados muito pequenos
                    continue
                    
                # Cria bounding box do componente
                xs = [p[0] for p in component]
                ys = [p[1] for p in component]
                minx, maxx = min(xs), max(xs)
                miny, maxy = min(ys), max(ys)
                
                # Para simplificar, vamos criar um contorno usando
                # detecção de borda do componente
                comp_mask = np.zeros((maxy-miny+3, maxx-minx+3), dtype=bool)
                for cx, cy in component:
                    comp_mask[cy-miny+1, cx-minx+1] = True
                
                # Algoritmo de contorno: percorre borda externa
                # Usamos uma abordagem de "marching squares" simplificada
                ch, cw = comp_mask.shape
                edge = np.zeros((ch, cw), dtype=bool)
                for cy in range(1, ch-1):
                    for cx in range(1, cw-1):
                        if comp_mask[cy, cx]:
                            # É borda se algum vizinho for False
                            if not (comp_mask[cy-1, cx] and comp_mask[cy+1, cx] and 
                                    comp_mask[cy, cx-1] and comp_mask[cy, cx+1]):
                                edge[cy, cx] = True
                
                # Extrai pontos da borda em ordem
                edge_pts = [(cx-1+minx, cy-1+miny) for cy in range(ch) for cx in range(cw) if edge[cy, cx]]
                if len(edge_pts) < 3:
                    continue
                
                # Simplificação: usar convex hull ou apenas bounding box simplificado
                # Para UI, vamos usar uma aproximação por retângulos quando possível
                # Mas para ser fiel, vamos criar um polígono simples a partir dos pontos extremos
                
                # Ordena pontos em ordem circular ao redor do centroide
                cx_center = sum(p[0] for p in edge_pts) / len(edge_pts)
                cy_center = sum(p[1] for p in edge_pts) / len(edge_pts)
                edge_pts.sort(key=lambda p: np.arctan2(p[1]-cy_center, p[0]-cx_center))
                
                # Simplifica: reduz pontos muito próximos
                simplified = [edge_pts[0]]
                for pt in edge_pts[1:]:
                    last = simplified[-1]
                    if abs(pt[0]-last[0]) > 2 or abs(pt[1]-last[1]) > 2:
                        simplified.append(pt)
                if len(simplified) > 2 and simplified[0] != simplified[-1]:
                    # Fecha o polígono se necessário
                    pass
                
                contours.append(simplified)
    
    return contours

def png_to_svg(png_path, svg_path, colors=32):
    img = Image.open(png_path).convert('RGBA')
    w, h = img.size
    
    # Cria fundo branco para áreas transparentes
    bg = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    img = Image.alpha_composite(bg, img)
    
    # Quantiza para reduzir número de cores
    img_rgb = img.convert('RGB')
    quantized = img_rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    
    arr = np.array(quantized)
    # Obtém paleta única de cores
    unique_colors = np.unique(arr.reshape(-1, 3), axis=0)
    
    svg_parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">']
    
    processed = 0
    for color in unique_colors:
        r, g, b = int(color[0]), int(color[1]), int(color[2])
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        
        # Cria máscara para esta cor (com tolerância)
        mask = (arr[:,:,0] == r) & (arr[:,:,1] == g) & (arr[:,:,2] == b)
        
        if not np.any(mask):
            continue
            
        # Para performance, trabalha com componentes conexos
        contours = trace_contours(mask)
        
        for contour in contours:
            if len(contour) < 3:
                continue
            path_data = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in contour) + " Z"
            svg_parts.append(f'<path d="{path_data}" fill="{hex_color}" stroke="none"/>')
        
        processed += 1
        if processed % 10 == 0:
            print(f"  Processando cor {processed}/{len(unique_colors)}...")
    
    svg_parts.append('</svg>')
    
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(svg_parts))
    
    print(f"Salvo: {svg_path}")

def main():
    png_files = sorted(WORKDIR.glob("*.png"))
    if not png_files:
        print("Nenhum arquivo PNG encontrado.")
        return
    
    print(f"Encontrados {len(png_files)} arquivos PNG.")
    for png in png_files:
        svg = png.with_suffix('.svg')
        print(f"Convertendo: {png.name} -> {svg.name}")
        try:
            png_to_svg(png, svg, colors=24)
        except Exception as e:
            print(f"ERRO em {png.name}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    main()
