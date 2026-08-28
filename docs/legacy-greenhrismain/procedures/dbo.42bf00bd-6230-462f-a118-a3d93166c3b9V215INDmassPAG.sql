create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmassPAG]
@idclient varchar(20),
@PayrollPeriodStart Date
AS
BEGIN

SET NOCOUNT ON;

DECLARE 
    @idemployee0 INT,
    @idpayroll0 INT,
    @sssbasis0 NVARCHAR(20),
    @grossamt0 FLOAT,
    @basicamt0 FLOAT,
    @otherbasisamt0 FLOAT,
    @withsss NVARCHAR(20),
    @withssspro NVARCHAR(20),
    @withphi NVARCHAR(20),
    @withpag NVARCHAR(20)

-- ✅ Preload static values (avoid repeated queries)
DECLARE @pagibigcontribution FLOAT
SELECT TOP 1 @pagibigcontribution = pagibigcontributionee 
FROM pagibigtable 
ORDER BY dateupdate DESC

-- ✅ Main Cursor (kept as requested pattern)
DECLARE myCursor0 CURSOR LOCAL FAST_FORWARD FOR
SELECT idpayrollsum, employee_id, sssbasis, grossalary, basic, othermandatorybasis, withsss, withssspro, withphi, withpag
FROM payroll_summary 
WHERE idclientp = @idclient 
AND Date_Start = @PayrollPeriodStart
ORDER BY idpayrollsum

OPEN myCursor0
FETCH NEXT FROM myCursor0 INTO 
    @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,
    @withsss,@withssspro,@withphi,@withpag

WHILE @@FETCH_STATUS = 0
BEGIN

    ----------------------------------------------------
    -- 🔹 PAG-IBIG COMPUTATION (SET-BASED INSIDE)
    ----------------------------------------------------

    DECLARE 
        @pagbasis VARCHAR(7),
        @countempidpag INT,
        @forpagtotalgross FLOAT,
        @forpagibigcontributionother FLOAT,
        @pageebasic FLOAT,
        @pageebasic2 FLOAT,
        @pagerbasic2 FLOAT

    -- ✅ Get basis once
    SELECT TOP 1 @pagbasis = sssbasis
    FROM payroll_summary
    WHERE employee_id = @idemployee0
    AND idclientp = @idclient
    AND Date_Start = @PayrollPeriodStart

    -- ✅ Count transactions
    SELECT @countempidpag = COUNT(*)
    FROM payroll_summary
    WHERE employee_id = @idemployee0
    AND idclientp = @idclient
    AND Date_Start = @PayrollPeriodStart

    -- ✅ Total gross (excluding current)
    SELECT @forpagtotalgross = COALESCE(SUM(grossalary),0)
    FROM payroll_summary
    WHERE employee_id = @idemployee0
    AND idclientp = @idclient
    AND Date_Start = @PayrollPeriodStart
    AND idpayrollsum <> @idpayroll0

    -- ✅ Previous contributions
    SELECT @forpagibigcontributionother = COALESCE(SUM(contributionPagibigEE),0)
    FROM payroll_summary
    WHERE employee_id = @idemployee0
    AND idclientp = @idclient
    AND Date_Start = @PayrollPeriodStart
    AND idpayrollsum < @idpayroll0

    -- ✅ Add current gross
    SET @forpagtotalgross = @grossamt0 + @forpagtotalgross

    -- ✅ SAME FORMULA (unchanged)
    SET @pageebasic =  
        CASE 
            WHEN @forpagtotalgross > 1000.00 
                THEN @pagibigcontribution - @forpagibigcontributionother
            ELSE 0
        END

    ----------------------------------------------------
    -- 🔹 SAME CONDITIONS (PRESERVED)
    ----------------------------------------------------

    IF @withpag = 'Y'
    BEGIN
        IF (@pagbasis = 'gross' AND @countempidpag >= 1)
        BEGIN
            SET @pageebasic2 = @pageebasic
            SET @pagerbasic2 = @pageebasic
        END

        IF (@pagbasis = 'basic' AND @countempidpag >= 1)
        BEGIN
            SET @pageebasic2 = @pageebasic
            SET @pagerbasic2 = @pageebasic
        END

        IF (@pagbasis = 'others' AND @countempidpag >= 1)
        BEGIN
            SET @pageebasic2 = @pageebasic
            SET @pagerbasic2 = @pageebasic
        END
    END
    ELSE
    BEGIN
        SET @pageebasic2 = 0
        SET @pagerbasic2 = 0
    END

    ----------------------------------------------------
    -- 🔹 UPDATE (unchanged behavior)
    ----------------------------------------------------

    UPDATE payroll_summary
    SET 
        contributionPagibigEE = @pageebasic2,
        contributionPagibigER = @pagerbasic2
    WHERE idpayrollsum = @idpayroll0
    AND trxtypep = 'Normal'

    FETCH NEXT FROM myCursor0 INTO 
        @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,
        @withsss,@withssspro,@withphi,@withpag

END

CLOSE myCursor0
DEALLOCATE myCursor0

END
 	