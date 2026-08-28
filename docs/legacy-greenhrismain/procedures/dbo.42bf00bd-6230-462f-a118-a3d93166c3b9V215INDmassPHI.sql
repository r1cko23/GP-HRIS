
create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmassPHI]
				  
@idclient varchar(20),
@PayrollPeriodStart Date

AS
BEGIN

DECLARE @idemployee0 INT
DECLARE @idpayroll0 INT
DECLARE @sssbasis0 NVARCHAR(20)
DECLARE @grossamt0 FLOAT
DECLARE @basicamt0 FLOAT
DECLARE @otherbasisamt0 FLOAT
DECLARE @withsss NVARCHAR(20)
DECLARE @withssspro NVARCHAR(20)
DECLARE @withphi NVARCHAR(20)
DECLARE @withpag NVARCHAR(20)

-- ================= OUTER CURSOR =================
DECLARE myCursor0 CURSOR FOR
SELECT idpayrollsum, employee_id, sssbasis, grossalary, basic, othermandatorybasis,
       withsss, withssspro, withphi, withpag
FROM payroll_summary
WHERE idclientp = @idclient 
AND Date_Start = @PayrollPeriodStart
ORDER BY idpayrollsum

OPEN myCursor0

FETCH NEXT FROM myCursor0 
INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,
     @withsss,@withssspro,@withphi,@withpag

WHILE @@FETCH_STATUS = 0
BEGIN

-- =========================================
-- VARIABLES (UNCHANGED)
-- =========================================
DECLARE @phibasis VARCHAR(7)
DECLARE @pidpayrollsum2 VARCHAR(20)
DECLARE @countempidphi INT

DECLARE @phieevalue1basic FLOAT
DECLARE @phiervalue1basic FLOAT
DECLARE @phieevalue1gross FLOAT
DECLARE @phiervalue1gross FLOAT
DECLARE @phieevalue1otherbasis FLOAT
DECLARE @phiervalue1otherbasis FLOAT

DECLARE @phipercentbasic FLOAT
DECLARE @phipercentgross FLOAT 
DECLARE @phipercentotherbasis FLOAT 

DECLARE @forphitotalgross FLOAT
DECLARE @forphitotalgross2 FLOAT
DECLARE @forphitotalbasic FLOAT
DECLARE @forphitotalbasic2 FLOAT
DECLARE @forphitotalotherbasis FLOAT
DECLARE @forphitotalotherbasis2 FLOAT

DECLARE @phiIDgross INT 
DECLARE @phiIDbasic INT
DECLARE @phiIDotherbasis INT

DECLARE @phieegross FLOAT
DECLARE @phiergross FLOAT
DECLARE @phieebasic FLOAT
DECLARE @phierbasic FLOAT
DECLARE @phieeotherbasis FLOAT
DECLARE @phierotherbasis FLOAT

DECLARE @phieebasic2 FLOAT
DECLARE @phierbasic2 FLOAT

DECLARE @forphilhealtheecontributionother FLOAT
DECLARE @forphilhealthercontributionother FLOAT 

-- =========================================
-- 🔥 HYBRID (SET-BASED PART)
-- =========================================

-- Basis + count
SELECT 
    @phibasis = MAX(philhealthbasis),
    @countempidphi = COUNT(*)
FROM payroll_summary
WHERE employee_id = @idemployee0
AND idclientp = @idclient
AND Date_Start = @PayrollPeriodStart

-- Max payroll row
SELECT TOP 1 
    @pidpayrollsum2 = idpayrollsum
FROM payroll_summary
WHERE employee_id = @idemployee0 
AND idclientp = @idclient 
AND Date_Start = @PayrollPeriodStart
ORDER BY grossalary DESC

-- 🔥 ONE query replaces MANY
SELECT 
    @forphitotalgross = COALESCE(SUM(grossamttaxable),0),
    @forphitotalbasic = COALESCE(SUM(basic),0),
    @forphitotalotherbasis = COALESCE(SUM(othermandatorybasis),0),
    @forphilhealtheecontributionother = COALESCE(SUM(contributionphilhealthEE),0),
    @forphilhealthercontributionother = COALESCE(SUM(contributionphilhealthER),0)
FROM payroll_summary
WHERE employee_id = @idemployee0
AND idclientp = @idclient
AND Date_Start = @PayrollPeriodStart
AND idpayrollsum < @idpayroll0

-- Totals
SET @forphitotalgross2 = @grossamt0 + @forphitotalgross
SET @forphitotalbasic2 = @basicamt0 + @forphitotalbasic
SET @forphitotalotherbasis2 = @otherbasisamt0 + @forphitotalotherbasis

-- =========================================
-- PHILHEALTH LOOKUPS (OPTIMIZED)
-- =========================================

-- GROSS
SELECT TOP 1 @phiIDgross = idphilhealth 
FROM Philhealth_2018 
WHERE Range <= @forphitotalgross2 
ORDER BY Range DESC

SELECT 
    @phieevalue1gross = Employeephil,
    @phiervalue1gross = Employerphil,
    @phipercentgross = valPercentage
FROM Philhealth_2018 
WHERE idphilhealth = @phiIDgross

-- BASIC
SELECT TOP 1 @phiIDbasic = idphilhealth 
FROM Philhealth_2018 
WHERE Range <= @forphitotalbasic2 
ORDER BY Range DESC

SELECT 
    @phieevalue1basic = Employeephil,
    @phiervalue1basic = Employerphil,
    @phipercentbasic = valPercentage
FROM Philhealth_2018 
WHERE idphilhealth = @phiIDbasic

-- OTHER
SELECT TOP 1 @phiIDotherbasis = idphilhealth 
FROM Philhealth_2018 
WHERE Range <= @forphitotalotherbasis2 
ORDER BY Range DESC

SELECT 
    @phieevalue1otherbasis = Employeephil,
    @phiervalue1otherbasis = Employerphil,
    @phipercentotherbasis = valPercentage
FROM Philhealth_2018 
WHERE idphilhealth = @phiIDotherbasis

-- =========================================
-- COMPUTATION (UNCHANGED LOGIC)
-- =========================================

SET @phieegross =
CASE 
    WHEN @forphitotalgross2 >=1000 THEN  
        CASE  
            WHEN @phiIDgross = 1 THEN @phieevalue1gross - @forphilhealtheecontributionother
            WHEN @phiIDgross = 2 THEN ((@forphitotalgross2*@phipercentgross)/2) - @forphilhealtheecontributionother
            WHEN @phiIDgross = 3 THEN @phieevalue1gross - @forphilhealtheecontributionother
        END
    ELSE 0
END

SET @phiergross =
CASE 
    WHEN @forphitotalgross2 >=1000 THEN  
        CASE  
            WHEN @phiIDgross = 1 THEN @phiervalue1gross - @forphilhealthercontributionother
            WHEN @phiIDgross = 2 THEN ((@forphitotalgross2*@phipercentgross)/2) - @forphilhealthercontributionother
            WHEN @phiIDgross = 3 THEN @phiervalue1gross - @forphilhealthercontributionother
        END
    ELSE 0
END

-- BASIC
SET @phieebasic =
CASE 
    WHEN @forphitotalgross2 >=1000 THEN  
        CASE 
            WHEN @phiIDbasic = 1 THEN @phieevalue1basic - @forphilhealtheecontributionother
            WHEN @phiIDbasic = 2 THEN ((@forphitotalbasic2*@phipercentbasic)/2) - @forphilhealtheecontributionother
            WHEN @phiIDbasic = 3 THEN @phieevalue1basic - @forphilhealtheecontributionother
        END
    ELSE 0
END

SET @phierbasic =
CASE 
    WHEN @forphitotalgross2 >=1000 THEN  
        CASE  
            WHEN @phiIDbasic = 1 THEN @phiervalue1basic - @forphilhealthercontributionother
            WHEN @phiIDbasic = 2 THEN ((@forphitotalbasic2*@phipercentbasic)/2) - @forphilhealthercontributionother
            WHEN @phiIDbasic = 3 THEN @phiervalue1basic - @forphilhealthercontributionother
        END
    ELSE 0
END

-- OTHER
SET @phieeotherbasis =
CASE 
    WHEN @forphitotalgross2 >=1000 THEN  
        CASE 
            WHEN @phiIDotherbasis = 1 THEN @phieevalue1otherbasis - @forphilhealtheecontributionother
            WHEN @phiIDotherbasis = 2 THEN ((@forphitotalotherbasis2*@phipercentotherbasis)/2) - @forphilhealtheecontributionother
            WHEN @phiIDotherbasis = 3 THEN @phieevalue1otherbasis - @forphilhealtheecontributionother
        END
    ELSE 0
END

SET @phierotherbasis =
CASE 
    WHEN @forphitotalgross2 >=1000 THEN  
        CASE  
            WHEN @phiIDotherbasis = 1 THEN @phiervalue1otherbasis - @forphilhealthercontributionother
            WHEN @phiIDotherbasis = 2 THEN ((@forphitotalotherbasis2*@phipercentotherbasis)/2) - @forphilhealthercontributionother
            WHEN @phiIDotherbasis = 3 THEN @phiervalue1otherbasis - @forphilhealthercontributionother
        END
    ELSE 0
END

-- =========================================
-- FINAL ASSIGNMENT (UNCHANGED)
-- =========================================

IF @withphi='Y'
BEGIN
    IF @phibasis = 'gross'
    BEGIN
        SET @phieebasic2 = @phieegross
        SET @phierbasic2 = @phiergross
    END
    ELSE IF @phibasis = 'basic'
    BEGIN
        SET @phieebasic2 = @phieebasic
        SET @phierbasic2 = @phierbasic
    END
    ELSE IF @phibasis = 'others'
    BEGIN
        SET @phieebasic2 = @phieeotherbasis
        SET @phierbasic2 = @phierotherbasis
    END
END

-- =========================================
-- UPDATE (UNCHANGED)
-- =========================================
UPDATE payroll_summary  
SET contributionphilhealthEE = ROUND(@phieebasic2,2),
    contributionphilhealthER = ROUND(@phieebasic2,2)
WHERE idpayrollsum = @idpayroll0  
AND trxtypep ='Normal'

FETCH NEXT FROM myCursor0 
INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,
     @withsss,@withssspro,@withphi,@withpag

END

CLOSE myCursor0
DEALLOCATE myCursor0

END