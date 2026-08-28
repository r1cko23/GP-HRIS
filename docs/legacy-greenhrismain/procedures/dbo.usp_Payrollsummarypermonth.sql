-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_Payrollsummarypermonth]
--@paraidclientp int,
--@paraiddepart nchar(10)
--@paradatestart date
--@uname varchar(20), 
--@datestart date
@payrollmonth varchar(20),
@clientstatus varchar(8),
@dstart date,
@dend date


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
	[idclient] int,
	[Headcount] int,
	[Manhours] float,
	[Salaries] FLOAT,
	[thirteenmonth] FLOAT,
	[SIL] FLOAT,
	[sssee] FLOAT,
    [phiee] FLOAT,
    [pagee] FLOAT,
    [wtax] FLOAT,
    [sssloan] FLOAT DEFAULT 0,
    [pagibigloan] FLOAT DEFAULT 0,
    [otherdeduction] FLOAT DEFAULT 0,   
    [ssser] FLOAT,
    [phier] FLOAT,
    [pager] FLOAT,
    [ecc] FLOAT,  
	[sssproer] FLOAT,  
    [thirteenmonthytd] FLOAT
    
);

-- Insert data from the payroll_summary table into the #TempTable
--DECLARE @payrollmonth VARCHAR(20) = 'June 2023'
--DECLARE @clientstatus VARCHAR(8) = 'Active'

CREATE INDEX idx_companyname ON #TempTable (Companyname);



INSERT INTO #TempTable (Companyname,Headcount,[Manhours],[Salaries],thirteenmonth,SIL,sssee, phiee, pagee,  wtax , ssser, phier, pager, ecc,sssproer, thirteenmonthytd)

SELECT
ViewPayrollSummarymonthly.companyname,
COUNT(DISTINCT Employee_id) AS headcount,
SUM(ViewPayrollSummarymonthly.noofhourswork) AS manhours,
SUM(ViewPayrollSummarymonthly.grossalary) AS Salaries,
SUM(ViewPayrollSummarymonthly.thirteenmonth) AS thirteenmonth,
SUM(ViewPayrollSummarymonthly.silp) AS SIL,
SUM(ViewPayrollSummarymonthly.contributionSSSEE) AS sssee,
SUM(ViewPayrollSummarymonthly.contributionphilhealthEE) AS phiee,
SUM(ViewPayrollSummarymonthly.contributionPagibigEE) AS pagee,
SUM(ViewPayrollSummarymonthly.Wtax) AS wtax,
SUM(ViewPayrollSummarymonthly.contributionSSSER) AS ssser,
SUM(ViewPayrollSummarymonthly.contributionphilhealthER) AS phier,
SUM(ViewPayrollSummarymonthly.contributionPagibigER) AS pager,
SUM(ViewPayrollSummarymonthly.contributionSSSECC) AS ecc,
SUM(ViewPayrollSummarymonthly.contributionSSSERpro) AS sssproer,
SUM(ViewPayrollSummarymonthly.thirteenmonthyear) AS thirteenmonthytd
FROM
    ViewPayrollSummarymonthly
WHERE
    (ViewPayrollSummarymonthly.payrollmonth = @payrollmonth)

GROUP BY
    ViewPayrollSummarymonthly.companyname;






--SSS loan 
INSERT INTO [#TempTable]
                         (Companyname, sssloan)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS sssloan
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'SSS Loan') AND (payroll_summary.payrollmonth = @payrollmonth)
GROUP BY client.companyname


--pag-ibig loan 
INSERT INTO [#TempTable]
                         (Companyname, pagibigloan)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS pagibigloan1
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'Pag-ibig Loan') AND (payroll_summary.payrollmonth = @payrollmonth)
GROUP BY client.companyname


--Other Deduction
INSERT INTO [#TempTable]
(Companyname, otherdeduction)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS Otherduduction
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular <> N'Pag-ibig Loan') AND (otherdeduction.particular <> N'SSS Loan') AND (payroll_summary.payrollmonth = @payrollmonth) 
GROUP BY client.companyname




-- Retrieve data from #TempTable
--SELECT * FROM #TempTable order by Companyname;


SELECT        Companyname, 
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
GROUP BY Companyname


-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

