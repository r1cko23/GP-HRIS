-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<Client Chart>
-- =============================================
CREATE PROCEDURE [dbo].[dashboardTCperyear]
@idclient nvarchar(30),
@idorganization int

AS	

BEGIN

--declare @idclientlast int

SET NOCOUNT ON;
 
create TABLE #TempTablepayrollchart(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	[idclientp] int,
	[companyname] NVARCHAR(100),	
	[year1]	int,
	[year2] int, 
	[grossamount] float default 0,
	[grossamount2] float default 0,	
	[payrollmonth] NVARCHAR(100),
	[payrollmonth2] NVARCHAR(100),
	[payrollmonthsort] int,
	[payrollmonthsort2] int,
	[month1] int
   
   );

-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idxcompanyname ON #TempTablepayrollchart (companyname);
CREATE INDEX idxmonth1 ON #TempTablepayrollchart (month1);

if @idclient <> ''
BEGIN
	INSERT INTO #TempTablepayrollchart (year1, payrollmonth, grossamount,payrollmonthsort,month1)
		
	SELECT  2023 as yearx, payrollmonth
	, ROUND(SUM(grossalary)+ SUM(thirteenmonth) +SUM(silp) + SUM(contributionSSSER) +SUM(contributionphilhealthER) +SUM(contributionPagibigER) +SUM(contributionSSSECC) +SUM(contributionSSSERpro) , 2)   AS totalgross	
	,payrollmonthsort	
	,RIGHT(payrollmonthsort,2) as finalsort
	FROM            payroll_summary INNER JOIN
                client ON payroll_summary.idclientp = client.idclient
	WHERE        payrollyear = 2023	AND idclientp = @idclient
	GROUP BY payrollmonth,payrollmonthsort
END

if @idclient = '' OR @idclient IS NULL
BEGIN
	INSERT INTO #TempTablepayrollchart (year1, payrollmonth, grossamount,payrollmonthsort,month1)
		
	SELECT  2023 as yearx, payrollmonth
	, ROUND(SUM(grossalary)+ SUM(thirteenmonth) +SUM(silp) + SUM(contributionSSSER) +SUM(contributionphilhealthER) +SUM(contributionPagibigER) +SUM(contributionSSSECC) +SUM(contributionSSSERpro) , 2)   AS totalgross	
	,payrollmonthsort	
	,RIGHT(payrollmonthsort,2) as finalsort
	FROM            payroll_summary INNER JOIN
                client ON payroll_summary.idclientp = client.idclient
	WHERE        payrollyear = 2023	
	GROUP BY payrollmonth,payrollmonthsort
END






	DECLARE @year2 int
	DECLARE @payrollmonth2 nvarchar(30)
	DECLARE @totalgross2 float
	DECLARE @payrollmonthsort2 float
	DECLARE @month2 float

IF @idclient <>''
BEGIN
	DECLARE myCursor CURSOR FOR
	
	SELECT  top 20  2024 as yearx ,payrollmonth ,
	ROUND(SUM(grossalary)+ SUM(thirteenmonth) +SUM(silp) + SUM(contributionSSSER) +SUM(contributionphilhealthER) +SUM(contributionPagibigER) +SUM(contributionSSSECC) +SUM(contributionSSSERpro) , 2)   AS totalgross	
	,payrollmonthsort ,  CAST(RIGHT(payrollmonthsort, 2) AS INT) AS finalsort
					  
	FROM payroll_summary INNER JOIN
    client ON payroll_summary.idclientp = client.idclient
	WHERE   payrollyear = 2024	   AND idclientp = @idclient
	GROUP BY payrollmonth,payrollmonthsort
		
	
	OPEN myCursor
	
	FETCH NEXT FROM myCursor INTO @year2,@payrollmonth2, @totalgross2, @payrollmonthsort2, @month2
	
	WHILE @@FETCH_STATUS = 0
	BEGIN  
			--begin transaction
				--update grossamount
				Update #TempTablepayrollchart
				set  year2 = @year2, payrollmonth2 = @payrollmonth2, grossamount2 =@totalgross2, payrollmonthsort2 =@payrollmonthsort2
				where #TempTablepayrollchart.month1 = @month2
			--commit
					

		FETCH NEXT FROM myCursor INTO @year2,@payrollmonth2, @totalgross2, @payrollmonthsort2, @month2
	END
	CLOSE myCursor
	DEALLOCATE myCursor
END

IF @idclient = '' OR @idclient  IS NULL 
BEGIN
	DECLARE myCursor CURSOR FOR
	
	SELECT  top 20  2024 as yearx ,payrollmonth ,
	ROUND(SUM(grossalary)+ SUM(thirteenmonth) +SUM(silp) + SUM(contributionSSSER) +SUM(contributionphilhealthER) +SUM(contributionPagibigER) +SUM(contributionSSSECC) +SUM(contributionSSSERpro) , 2)   AS totalgross	
	,payrollmonthsort ,  CAST(RIGHT(payrollmonthsort, 2) AS INT) AS finalsort
					  
	FROM payroll_summary INNER JOIN
    client ON payroll_summary.idclientp = client.idclient
	WHERE   payrollyear = 2024
	GROUP BY payrollmonth,payrollmonthsort
		
	
	OPEN myCursor
	
	FETCH NEXT FROM myCursor INTO @year2,@payrollmonth2, @totalgross2, @payrollmonthsort2, @month2
	
	WHILE @@FETCH_STATUS = 0
	BEGIN  
			--begin transaction
				--update grossamount
				Update #TempTablepayrollchart
				set  year2 = @year2, payrollmonth2 = @payrollmonth2, grossamount2 =@totalgross2, payrollmonthsort2 =@payrollmonthsort2
				where #TempTablepayrollchart.month1 = @month2
			--commit
					

		FETCH NEXT FROM myCursor INTO @year2,@payrollmonth2, @totalgross2, @payrollmonthsort2, @month2
	END
	CLOSE myCursor
	DEALLOCATE myCursor
END


								   		  
 /*
INSERT INTO TempTablepayrollchart (year2, payrollmonth2, grossamount2,payrollmonthsort2,month1)
		
SELECT  top 20  2024 as yearx , payrollmonth,   ROUND(SUM(grossalary), 2)  AS totalgross	,payrollmonthsort, RIGHT(payrollmonthsort,2) as finalsort
FROM            payroll_summary INNER JOIN
              client ON payroll_summary.idclientp = client.idclient
WHERE        payrollyear = 2024

GROUP BY payrollmonth,payrollmonthsort
  */

SELECT   
    grossamount AS sumofgross1, 
    grossamount2 AS sumofgross2, 
    payrollmonth, 
    payrollmonth2, 
    month1, 
    payrollmonthsort, 
    CASE 
        WHEN month1 = 1 THEN 'January'
        WHEN month1 = 2 THEN 'February'
        WHEN month1 = 3 THEN 'March'
        WHEN month1 = 4 THEN 'April'
        WHEN month1 = 5 THEN 'May'
        WHEN month1 = 6 THEN 'June'
        WHEN month1 = 7 THEN 'July'
        WHEN month1 = 8 THEN 'August'
        WHEN month1 = 9 THEN 'September'
        WHEN month1 = 10 THEN 'October'
        WHEN month1 = 11 THEN 'November'
        WHEN month1 = 12 THEN 'December'
    END AS MonthName
FROM #TempTablepayrollchart
ORDER BY month1, payrollmonthsort, payrollmonthsort2;


-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTablepayrollchart;
END

