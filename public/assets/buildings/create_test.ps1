Add-Type -AssemblyName System.Drawing

$w = 512
$h = 512
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)

# Diamond matching game's HEIGHT_RATIO = 0.60
$cx = $w / 2
$baseTop = $h * 0.30
$diamondW = $w * 0.80
$diamondH = $diamondW * 0.60

$points = @(
    [System.Drawing.Point]::new($cx, $baseTop),
    [System.Drawing.Point]::new($cx + $diamondW/2, $baseTop + $diamondH/2),
    [System.Drawing.Point]::new($cx, $baseTop + $diamondH),
    [System.Drawing.Point]::new($cx - $diamondW/2, $baseTop + $diamondH/2)
)

$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 255, 0, 0))
$g.FillPolygon($brush, $points)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 3)
$g.DrawPolygon($pen, $points)

$g.Dispose()
$brush.Dispose()
$pen.Dispose()
$bmp.Save("c:\Users\marcg\Desktop\meinort\mapGame\public\assets\buildings\test_diamond.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Test-Diamant erstellt (512x512, HEIGHT_RATIO=0.60)"
