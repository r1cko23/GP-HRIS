-- =============================================
-- Author:		Pats Relos
-- Create date: <10-3-2024>
-- Description:	<Payroll Summary Per Client>
-- =============================================
create PROCEDURE [dbo].[usp_monthlypayrollsummaryreport]

@payrollyear int,
@idclient int,
@clientname nvarchar(50)

AS	

BEGIN
--SET @paradatestart = CONVERT(DATE, @paradatestart, 101) 
--SET @paradatestart = '2023-04-01'

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


CREATE TABLE #TempTable (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [Companyname] NVARCHAR(100),
	[payrollmonth] NVARCHAR(30),
	[payrollmonthsort] NVARCHAR(8),
	[idclient] int,
	[Headcount] int DEFAULT 0,
	[Manhours] float DEFAULT 0,
	[Salaries] FLOAT DEFAULT 0,
	[thirteenmonth] FLOAT,
	[SIL] FLOAT DEFAULT 0,
	[sssee] FLOAT DEFAULT 0,
    [phiee] FLOAT DEFAULT 0,
    [pagee] FLOAT DEFAULT 0,
    [wtax] FLOAT DEFAULT 0,
    [sssloan] FLOAT DEFAULT 0,
    [pagibigloan] FLOAT DEFAULT 0,
    [otherdeduction] FLOAT DEFAULT 0,   
    [ssser] FLOAT DEFAULT 0,
    [phier] FLOAT DEFAULT 0,
    [pager] FLOAT DEFAULT 0,
    [ecc] FLOAT DEFAULT 0,  
	[sssproer] FLOAT DEFAULT 0,  
    [thirteenmonthytd] FLOAT DEFAULT 0
    
);

-- Insert data from the payroll_summary table into the #TempTable
--DECLARE @payrollmonth VARCHAR(20) = 'June 2023'
--DECLARE @clientstatus VARCHAR(8) = 'Active'

CREATE INDEX idx_payrollmonthsort ON #TempTable (payrollmonthsort);



INSERT INTO #TempTable (Companyname,payrollmonth,payrollmonthsort,Headcount,[Manhours],[Salaries],thirteenmonth,SIL,sssee, phiee, pagee,  wtax , ssser, phier, pager, ecc,sssproer, thirteenmonthytd)

SELECT
Viewmonthlypayrollsummaryreport.companyname,Viewmonthlypayrollsummaryreport.payrollmonth,Viewmonthlypayrollsummaryreport.payrollmonthsort,
COUNT(DISTINCT Employee_id) AS headcount,
SUM(Viewmonthlypayrollsummaryreport.noofhourswork) AS manhours,
SUM(Viewmonthlypayrollsummaryreport.grossalary) AS Salaries,
SUM(Viewmonthlypayrollsummaryreport.thirteenmonth) AS thirteenmonth,
SUM(Viewmonthlypayrollsummaryreport.silp) AS SIL,
SUM(Viewmonthlypayrollsummaryreport.contributionSSSEE) AS sssee,
SUM(Viewmonthlypayrollsummaryreport.contributionphilhealthEE) AS phiee,
SUM(Viewmonthlypayrollsummaryreport.contributionPagibigEE) AS pagee,
SUM(Viewmonthlypayrollsummaryreport.Wtax) AS wtax,
SUM(Viewmonthlypayrollsummaryreport.contributionSSSER) AS ssser,
SUM(Viewmonthlypayrollsummaryreport.contributionphilhealthER) AS phier,
SUM(Viewmonthlypayrollsummaryreport.contributionPagibigER) AS pager,
SUM(Viewmonthlypayrollsummaryreport.contributionSSSECC) AS ecc,
SUM(Viewmonthlypayrollsummaryreport.contributionSSSERpro) AS sssproer,
SUM(Viewmonthlypayrollsummaryreport.thirteenmonthyear) AS thirteenmonthytd
FROM
    Viewmonthlypayrollsummaryreport
WHERE
    (Viewmonthlypayrollsummaryreport.payrollyear = @payrollyear) and (Viewmonthlypayrollsummaryreport.idclientp = @idclient)

GROUP BY
    Viewmonthlypayrollsummaryreport.companyname,Viewmonthlypayrollsummaryreport.payrollmonth,Viewmonthlypayrollsummaryreport.payrollmonthsort





--SSS loan 
INSERT INTO [#TempTable]
                         (Companyname,payrollmonth,payrollmonthsort, sssloan)

SELECT DISTINCT client.companyname,payroll_summary.payrollmonth,payroll_summary.payrollmonthsort, SUM(otherdeduction.amount) AS sssloan
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'SSS Loan') AND (payroll_summary.payrollyear = @payrollyear) and (idclientp = @idclient)
GROUP BY client.companyname,payroll_summary.payrollmonth,payroll_summary.payrollmonthsort


--pag-ibig loan 
INSERT INTO [#TempTable]
                         (Companyname, payrollmonth,payrollmonthsort,pagibigloan)
SELECT DISTINCT client.companyname, payroll_summary.payrollmonth, payroll_summary.payrollmonthsort,SUM(otherdeduction.amount) AS pagibigloan1
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'Pag-ibig Loan') AND (payroll_summary.payrollyear = @payrollyear)and (idclientp = @idclient)
GROUP BY client.companyname,payroll_summary.payrollmonth,payroll_summary.payrollmonthsort


--Other Deduction
INSERT INTO [#TempTable]
(Companyname, payrollmonth, payrollmonthsort,otherdeduction)
SELECT DISTINCT client.companyname, payroll_summary.payrollmonth,payroll_summary.payrollmonthsort, SUM(otherdeduction.amount) AS Otherduduction
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular <> N'Pag-ibig Loan') AND (otherdeduction.particular <> N'SSS Loan') AND (payroll_summary.payrollyear = @payrollyear)  and (idclientp = @idclient)
GROUP BY client.companyname,payroll_summary.payrollmonth,payroll_summary.payrollmonthsort



-- Retrieve data from #TempTable
--SELECT * FROM #TempTable order by Companyname;


SELECT        payrollmonth, payrollmonthsort,
							SUM(Headcount) AS headcountx, 
							SUM(Manhours) AS Manhoursx, 
							SUM(Salaries) AS Salariesx, 
							SUM(thirteenmonth) AS thirteenmonthx, 
							SUM([SIL]) AS silx, 
							SUM(sssee) AS ssseex, 
							SUM(phiee) AS phieex, 
							SUM(pagee) AS pageex,
							SUM(wtax) AS wtaxx,
							SUM(sssloan) AS sssloanx,
							SUM(pagibigloan) AS pagibigloanx,
							SUM(otherdeduction) AS otherdeductionx,
							SUM(ssser) AS ssserx,
							SUM(ecc) AS eccx,
							SUM(sssproer) AS sssproerx,
							SUM(phier) AS phierx,
							SUM(pager) AS pagerx
FROM #TempTable
GROUP BY payrollmonth,payrollmonthsort


-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

