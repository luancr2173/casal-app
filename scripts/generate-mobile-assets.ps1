$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public\casalapp-logo.png'
$source = [System.Drawing.Image]::FromFile($sourcePath)
$background = $source.GetPixel(0, 0)
$backgroundHex = '#{0:X2}{1:X2}{2:X2}' -f $background.R, $background.G, $background.B

function Save-LogoPng {
    param(
        [string]$Path,
        [int]$Width,
        [int]$Height
    )

    $bitmap = [System.Drawing.Bitmap]::new(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear($background)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $scale = [Math]::Min($Width / [double]$source.Width, $Height / [double]$source.Height)
        $drawWidth = [int][Math]::Round($source.Width * $scale)
        $drawHeight = [int][Math]::Round($source.Height * $scale)
        $x = [int][Math]::Floor(($Width - $drawWidth) / 2)
        $y = [int][Math]::Floor(($Height - $drawHeight) / 2)
        $graphics.DrawImage($source, [System.Drawing.Rectangle]::new($x, $y, $drawWidth, $drawHeight))
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Save-AppIconPng {
    param(
        [string]$Path,
        [int]$Size
    )

    $bitmap = [System.Drawing.Bitmap]::new(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        # Crop the centered mark from the banner-like logo to fill launcher icon canvases.
        $crop = [System.Drawing.Rectangle]::new(262, 132, 500, 500)
        $destination = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
        $graphics.DrawImage($source, $destination, $crop, [System.Drawing.GraphicsUnit]::Pixel)
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    $androidRes = Join-Path $root 'android\app\src\main\res'
    $densitySizes = @{
        'mipmap-mdpi' = 48
        'mipmap-hdpi' = 72
        'mipmap-xhdpi' = 96
        'mipmap-xxhdpi' = 144
        'mipmap-xxxhdpi' = 192
    }

    foreach ($density in $densitySizes.Keys) {
        $directory = Join-Path $androidRes $density
        foreach ($name in @('ic_launcher.png', 'ic_launcher_round.png')) {
            Save-AppIconPng (Join-Path $directory $name) $densitySizes[$density]
        }

        $foregroundSize = [int]($densitySizes[$density] * 2.25)
        Save-AppIconPng (Join-Path $directory 'ic_launcher_foreground.png') $foregroundSize
    }

    $backgroundResource = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$backgroundHex</color>
</resources>
"@
    Set-Content -Path (Join-Path $androidRes 'values\ic_launcher_background.xml') -Value $backgroundResource -Encoding utf8

    Get-ChildItem $androidRes -Recurse -Filter 'splash.png' -File | ForEach-Object {
        $current = [System.Drawing.Image]::FromFile($_.FullName)
        $width = $current.Width
        $height = $current.Height
        $current.Dispose()
        Save-LogoPng $_.FullName $width $height
    }

    $iosAssets = Join-Path $root 'ios\App\App\Assets.xcassets'
    Save-AppIconPng (Join-Path $iosAssets 'AppIcon.appiconset\AppIcon-512@2x.png') 1024

    $splashSizes = @{
        'splash-2732x2732-2.png' = 1024
        'splash-2732x2732-1.png' = 1536
        'splash-2732x2732.png' = 2048
    }
    foreach ($file in $splashSizes.Keys) {
        Save-LogoPng (Join-Path $iosAssets "Splash.imageset\$file") $splashSizes[$file] $splashSizes[$file]
    }
}
finally {
    $source.Dispose()
}
